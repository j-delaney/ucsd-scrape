var _ = require('underscore');
var cape = require('./cape');
var gradeDist = require('./grade-dist');

var DEFAULT_LIMIT = 10;

function getCourseCodes(gradeDistData) {
    var seen = {};
    var courseCodes = [];
    _.each(gradeDistData, function (data) {
        var combined = data.subject + data.course;
        if (!seen[combined]) {
            seen[combined] = true;
            courseCodes.push({
                subject: data.subject,
                course: data.course
            });
        }
    });

    return courseCodes;
}

gradeDist.run(DEFAULT_LIMIT, function (gradeDistData) {
    gradeDist.formatCSV(gradeDistData, function () {
        var courseCodes = getCourseCodes(gradeDistData);
        cape.run(DEFAULT_LIMIT, courseCodes, function (capeData) {
            cape.formatCSV(capeData, function () {
                console.log('Done!');
            });
        });
    })
});