var gradeDist = require('./grade-dist');

var DEFAULT_LIMIT = 10;

gradeDist.run(DEFAULT_LIMIT, function (gradeDistData) {
    gradeDist.formatCSV(gradeDistData, function () {
        console.log('Done!');
    })
});