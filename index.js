var deferred = require('deferred');
var request = require('request');
var cheerio = require('cheerio');

var api = 'https://de.wiktionary.org/w/api.php?format=json&utf8&action=query&prop=extracts&rvprop=content&titles=';

var Word = function () {
    this.name = '';
    this.valid = true;
    this.explanations = [];
    this.examples = [];
    this.synonym = [];
    this.hyperonym = [];
    this.imgurl = '';
};

function query(word) {
    var def = deferred();

    if (!word) {
        return def.reject('Invalid word.');
    }

    var options = {
        url: api + word
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            return def.resolve(body);
        } else {
            return def.reject('Request error.');
        }
    });

    return def.promise;
};

function parse(data) {
    var word = new Word();

    try {
        var json = JSON.parse(data);
        var pages = json.query.pages;
        if (pages['-1']) {
            word.valid = false;
        } else {
            for (var key in pages) {
                var page = pages[key];
                var content = page.extract;
                //console.log( content);
                word.name = page.title;
                word.valid = true;

                var i = 0;
                var length = 0;

                var $ = cheerio.load(content,{
                    normalizeWhitespace: false,
                    xmlMode: true,
                    decodeEntities: true
                });
                //Explantation
                var $explanationList = $('p[title=\'Sinn und Bezeichnetes (Semantik)\']').next().children();

                for (i = 0, length = $explanationList.length; i < length; i++) {
                    var explanation = $($explanationList[i]).text();
                    word.explanations.push(explanation);
                }
                //Synonyms

                var $synonymsList = $('p[title=\'bedeutungsgleich gebrauchte Wörter\']').next().children();

                for (i = 0, length = $synonymsList.length; i < length; i++) {
                    var synonym = $($synonymsList[i]).text();
                    word.synonym.push(synonym);
                }
                //Hyperonyms
                var $hyperonymList = $('p[title=\'Hyperonyme\']').next().children();

                for (i = 0, length = $hyperonymList.length; i < length; i++) {
                    var hyperonym = $($hyperonymList[i]).text();
                    word.hyperonym.push(hyperonym);
                }

                //Examples
                var $exampleList = $('p[title=\'Verwendungsbeispielsätze\']').next().children();
                for (i = 0, length = $exampleList.length; i < length; i++) {
                    var example = $($exampleList[i]).text();
                    //var exampleobject = $($exampleList[i]);
                    //var reference = $(exampleobject).children().length;
                    // It may only contain index number like [3], [4a]
                    if (!/^\s*\[\d{1,2}\w?\]\s*$/i.test(example)) {
                        word.examples.push(example);
                    }
                }
                break;
            }
        }
    } catch (error) {
        word.valid = false;
    }
    return word;
};

//var print = require('./lib/print.js');
module.exports = {
    get_infos:  function(word) {
        query(word).done(function (data) {
        var word = parse(data);
        console.log(word);
        }, function (message) {
            console.log(message);
        });
    }

};


/*
function get_infos(word) {
    query(word).done(function (data) {
        var word = parse(data);
        console.log(word);
    }, function (message) {
        console.log(message);
    });
}

get_infos("Esel");
 */