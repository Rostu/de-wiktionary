var deferred = require('deferred');
var request = require('request');
var cheerio = require('cheerio');

//var wiktionaryapi = 'https://de.wiktionary.org/w/api.php?format=json&utf8&action=query&prop=extracts&export&titles=';
//var api = 'https://de.wiktionary.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=';
var imageapi = 'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&format=json&iiprop=url&iiurlwidth=220&titles=File:'

var wikiurl = 'https://de.wiktionary.org/wiki/';

var Word = function () {
    this.wordclass = '';
    this.valid = true;
    this.explanations = [];
    this.examples = [];
    this.etymologie = [];
    this.synonym = [];
    this.hyperonym = [];
    this.imgname = null;
    this.audio = [];
    this.error = '';
};

module.exports = {
    get_infos: function(searchterm, cb) {
        scrap_wiki(searchterm).done(function (data) {
            var word = parse(data);

            //after that we do a mediawiki API request to get the desired information on the sites first example image
            if (word.imgname) {
                queryimage(word.imgname).done(function (data) {
                    word.imgname = data;
                    //console.log(word);
                    cb(null, word);
                }, function (error) {
                    console.log(error);
                });
            }else{
                cb(null, word);
            }
        }, function (error) {
            console.log(error);
        });
    }
}

//sends a http request to the wikrionary api to get more informations about the pictures
//gets a string for the correspnding mediawiki image name and returns a JSON object with informations
function queryimage(imagename){
    var def = deferred();
    if (!imagename) {
        return def.reject('No image');
    }
    var options = {
        url: imageapi + imagename
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var json = JSON.parse(body);
            var pages = json.query.pages;
            for (var key in pages) {
                var page = pages[key];
                var imageinfos = page.imageinfo;
                //console.log(imageinfos[0]);
                return def.resolve(imageinfos);
                break;
            }

        } else {
            return def.reject("Query error!");
        }
    });
    return def.promise;

}

//this function creates a http get request and returns the body of the answer if the status code is 200,304 or 404
function scrap_wiki(word) {
    var def = deferred();
    if (!word) {
        return def.reject('Invalid word.');
    }
    var options = {
        url: wikiurl + word
    };
    request(options, function (error, response, body) {
        if (!error && response.statusCode === 200 | 404 | 304) {
            return def.resolve(body);
        } else {
            console.log(error);
            return def.reject("Query error!");
        }
    });
    return def.promise;
}

function parse(data) {
    var word = new Word();
    try {
        var $ = cheerio.load(data,{
            normalizeWhitespace: false,
            xmlMode: true,
            decodeEntities: true
        });

        //to get the pictures and some extra infos on them we have to go way around since not all desired informations can be found on the page that is scraped
        //first thing is to get the name of the desired image
        var image = $(".hintergrundfarbe2.rahmenfarbe1").find("a.image")[0];
        var imagename = $(image).attr('href');
        if(imagename){
            imagename = imagename.replace('/wiki/Datei:',"");
            word.imgname = imagename;
        }

        if ($("#noarticletext").length > 0) {
            word.valid = false;
            word.error = "Kein Eintrag";
        }else if($("span#Deklinierte_Form").length > 0){
            console.log("Deklinierte Form");
        }else {
                //Wortart
                var $wordclass = $('a[title=\'Hilfe:Wortart\']').parent().text();
                word.wordclass = $wordclass;

                //Audio
                var $audioList = $('a[title=\'Hilfe:Hörbeispiele\']').nextAll();

                for (i = 0, length = $audioList.length; i < length; i++) {
                    if( $($audioList[i])[0].name === "a"){
                        word.audio.push({link:"https:"+$($audioList[i]).attr('href'),info:"https://de.wiktionary.org"+$($audioList[i]).next('sup').children().attr('href')});
                    }
                }

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

                //Etymologie
                var $etymologie = $('p[title=\'Etymologie und Morphologie\']').next().children();
                for (i = 0, length = $etymologie.length; i < length; i++) {
                    var etymologie = $($etymologie[i]).text();
                    word.etymologie.push(etymologie);
                }

                //Examples
                var $exampleList = $('p[title=\'Verwendungsbeispielsätze\']').next().children();
                for (i = 0, length = $exampleList.length; i < length; i++) {
                    var example = $($exampleList[i]).text();
                    var exampletoken = $($exampleList[i]);
                    if($(exampletoken).children('.reference')&&!/^\s*\[\d{1,2}\w?\]\s*$/i.test(example)){
                        var reference_id = $(exampletoken).children('.reference').children('a').attr('href');
                        word.examples.push({text: example, referece:$("ol li"+reference_id).children('.reference-text').clone().html()});
                        // It may only contain index number like [3], [4a]
                    }else if (!/^\s*\[\d{1,2}\w?\]\s*$/i.test(example)) {
                        word.examples.push({text: example, referece:"" });
                    }
                }
            }

    } catch (error) {
        console.log(error);
        word.valid = false;
    }
    return word;
};


//livetesting

function get_infos(searchterm, cb) {

    scrap_wiki(searchterm).done(function (data) {
        var word = parse(data);

        //after that we do a mediawiki API request to get the desired information on the sites first example image
        if (word.imgname) {
            queryimage(word.imgname).done(function (data) {
                word.imgname = data;
                cb(null, word);
            }, function (error) {
                console.log(error);
            });
        }else{
            cb(null, word);
        }
    }, function (error) {
        console.log(error);
    });
}


/*
get_infos("Esel",function(err, dat){
    console.log(dat);
});
*/