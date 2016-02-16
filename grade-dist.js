var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var path = require('path');
var fs = require('fs');
var csv = require('fast-csv');

var BASE_URL = 'https://as.ucsd.edu/gradeDistribution/index/GradeDistribution_page/';
var EXPORT_FILENAME = 'gradedist.csv';

var data = [];
// {
//   term: "SP13",
//   subject: "PSYC",
//   course: "102",
//   title: "Intro/Sensation & Perception"
//   instructor: "Serences, John Thomas",
//   gpa: 3.345,
//   percentA: 45.6,
//   percentB: 39.7,
//   percentC: 7.6,
//   percentD: 0.8,
//   percentF: 0.4,
//   percentW: 1.7,
//   percentP: 3.8,
//   percentNP: 0.4
// }

function getPage(number, cb) {
    var url = BASE_URL + number;

    request(url, function (error, response, body) {
        if (error) {
            console.error('There was an error fetching ' + url);
            throw error;
        }

        if (response.statusCode !== 200) {
            throw Error('Status code was ' + response.statusCode + ' for page ');
        }

        cb(body);
    });
}

function parse(html, cb) {
    var $ = cheerio.load(html);
    var pageData = [];
    $('tbody').children().each(function (index, element) {
        var tdList = $(this).children();
        pageData.push({
            term: $(tdList.get(0)).text().trim(),
            subject: $(tdList.get(1)).text().trim(),
            course: $(tdList.get(2)).text().trim(),
            title: $(tdList.get(3)).text().trim(),
            instructor: $(tdList.get(4)).text().trim(),
            gpa: Number($(tdList.get(5)).text()),
            percentA: Number($(tdList.get(6)).text().slice(0, -1)) / 100,
            percentB: Number($(tdList.get(7)).text().slice(0, -1)) / 100,
            percentC: Number($(tdList.get(8)).text().slice(0, -1)) / 100,
            percentD: Number($(tdList.get(9)).text().slice(0, -1)) / 100,
            percentF: Number($(tdList.get(10)).text().slice(0, -1)) / 100,
            percentW: Number($(tdList.get(11)).text().slice(0, -1)) / 100,
            percentP: Number($(tdList.get(12)).text().slice(0, -1)) / 100,
            percentNP: Number($(tdList.get(13)).text().slice(0, -1)) / 100
        });
    });
    cb(pageData);
}

function getNumPages(cb) {
    getPage(1, function (html) {
        var $ = cheerio.load(html);

        // This will retur something like "Displaying 1-100 of 14955 results."
        var resultsText = $('#gradedistribution-grid').children('.summary').text();

        var results = resultsText.match(/of (\d*) results/);

        // If there are no results throw an error.
        if (!results) {
            throw Error('Unable to determine number of results. resultsText=' + resultsText);
        }

        var numResults;
        try {
            numResults = Number(results[1]);
        } catch (e) {
            console.error('Error parsing "' + resultsText + '"');
            throw e;
        }

        // There are 100 results per page.
        var numPages = Math.ceil(numResults / 100);
        var pages = [];
        for (var i = 1; i <= numPages; i++) {
            pages.push(i);
        }

        cb(pages);
    });
}

exports.run = function (limit, cb) {
    getNumPages(function (pages) {
        async.eachLimit(pages, limit, function (pageIndex, done) {
            getPage(pageIndex, function (html) {
                parse(html, function (pageData) {
                    data = data.concat(pageData);
                    done();
                });
            });
        }, function (err) {
            cb(data);
        });
    });
};

exports.formatCSV = function (data, cb) {
    var outFile = path.join('out', EXPORT_FILENAME);

    csv.writeToPath(outFile, data, {
        headers: true
    }).on('finish', function () {
        cb();
    });
};

module.exports = exports;