var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var path = require('path');
var fs = require('fs');
var csv = require('fast-csv');
var ProgressBar = require('progress');

var BASE_URL = 'http://cape.ucsd.edu/responses/Results.aspx?Name=&CourseNumber=';
var EXPORT_FILENAME = 'cape.csv';

var data = [];
// {
//   term: "FA15",
//   subject: "CSE",
//   course: "3",
//   title: "Fluency/Information Technology"
//   instructor: "Marx, Susan S",
//   enroll: 162,
//   evalsMade: 65,
//   recommendClass: .919,
//   recommendInstructor: .710,
//   studyHoursPerWeek: 4.07,
//   avgGPAExpected: 3.61,
//   avgGPAReceived: 3.72
// }

function getPage(courseCode, cb) {
    var url = BASE_URL + courseCode.subject + '+' + courseCode.course;

    // Need a valid user-agent or else the page will return a 404.
    request({
        url: url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36'
        }
    }, function (error, response, body) {
        if (error) {
            console.error('There was an error fetching ' + url);
            throw error;
        }

        if (response.statusCode !== 200) {
            throw Error('Status code was ' + response.statusCode + ' for page ' + url);
        }

        cb(body);
    });
}

function parse(html, courseCode, cb) {
    var $ = cheerio.load(html);

    if ($('#ctl00_ContentPlaceHolder1_gvCAPEs_ctl01_lblEmptyData').length) {
        return cb([]);
    }

    var pageData = [];
    $('tbody').children().each(function (index, element) {
        var tdList = $(this).children();
        var rowData = {};

        // Get the "easy" data.
        rowData.instructor = $(tdList.get(0)).text().trim();
        rowData.term = $(tdList.get(2)).text().trim();
        rowData.enroll = $(tdList.get(3)).text().trim();
        rowData.evalsMade = $(tdList.get(4)).text().trim();
        rowData.recommendClass = Number($(tdList.get(5)).text().trim().slice(0, -1)) / 100;
        rowData.recommendInstructor = Number($(tdList.get(6)).text().trim().slice(0, -1)) / 100;
        rowData.studyHoursPerWeek = Number($(tdList.get(7)).text().trim());

        // Get the subject, course, and title.
        // It will look like "CSE 3 - Fluency/Information Technology (A)"
        var subjectCourseTitle = $(tdList.get(1)).text().trim();
        if (subjectCourseTitle === 'No CAPEs submitted') {
            return;
        }
        var matches = subjectCourseTitle.match(/(.+)\s(.+)\s-\s(.+)/);
        if (matches === null) {
            console.error('courseCode', courseCode);
            console.error('rowData', rowData);
            throw Error('Could not match "' + subjectCourseTitle + '"');
        }
        rowData.subject = matches[1].trim();
        rowData.course = matches[2].trim();
        rowData.title = matches[3].trim();

        // If the subject and course don't match what we're looking for throw it out.
        if (rowData.subject !== courseCode.subject || rowData.course != courseCode.course) {
            return;
        }

        // Some courses have something like " (A)" at the end. Get rid of this.
        var lastIndex = rowData.title.lastIndexOf('(');
        if (lastIndex !== -1) {
            rowData.title = rowData.title.substr(0, lastIndex - 1).trim();
        }

        // Get avg GPA expected and received.
        // These are in the format "B+ (3.61)" or "N/A"
        rowData.avgGPAExpected = $(tdList.get(8)).text().trim();

        if (rowData.avgGPAExpected === 'N/A') {
            rowData.avgGPAExpected = '';
        } else {
            matches = rowData.avgGPAExpected.match(/[ABCDF][+-]?\s\((.+)\)/);
            if (matches === null) {
                console.error(rowData);
                throw Error('Could not match "' + rowData.avgGPAExpected + '"');
            }
            rowData.avgGPAExpected = Number(matches[1]);
        }

        rowData.avgGPAReceived = $(tdList.get(9)).text().trim();
        if (rowData.avgGPAReceived === 'N/A') {
            rowData.avgGPAReceived = '';
        } else {
            matches = rowData.avgGPAReceived.match(/[ABCDF][+-]?\s\((.+)\)/);
            if (matches === null) {
                console.error(rowData);
                throw Error('Could not match "' + rowData.avgGPAReceived + '"');
            }
            rowData.avgGPAReceived = Number(matches[1]);
        }

        pageData.push(rowData);
    });
    cb(pageData);
}

/**
 * Scrapes and parses the CAPEs for provided courses.
 * @param limit Max number of pages to fetch at once.
 * @param courseCodes An array of courses in the form {subject: String, course: String}
 * @param cb Callback function called with 1 argument (data).
 */
exports.run = function (limit, courseCodes, cb) {
    var progressBar = new ProgressBar('CAPE [:bar] :percent', {
        total: courseCodes.length
    });
    async.eachLimit(courseCodes, limit, function (courseCode, done) {
        getPage(courseCode, function (html) {
            parse(html, courseCode, function (pageData) {
                data = data.concat(pageData);
                progressBar.tick();

                done();
            })
        });
    }, function (err) {
        cb(data);
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