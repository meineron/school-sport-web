var express = require('express');
var settings = require('../../../settings');

var Data = settings.v2test ? require('../../test/manage/data') : require('../../models/manage/data');

var util = require('../util');

var router = express.Router();

// TODO - remove when not needed anymore
router.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

router.get('/', util.requireRole('admin', 'school', 'city', 'sport-admin', 'supervisor'), function (req, res) {
    Data.getSeasons(function(err, seasons) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send(seasons);
        }
    });
});

module.exports = router;