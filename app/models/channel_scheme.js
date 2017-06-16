// load the things we need
var mongoose = require('mongoose');
var ProgrammeSchema = require('./programme');
var public_settings_config = require('../../config/public_settings.js');

var DEFAUL_ICON_PATH = public_settings_config.site_domain + '/images/unknown_channel.png';

// define the schema for our channel model
var ChannelSchema = mongoose.Schema({
  url : String,
  name : String,
  price : {type : Number, default: 0},
  tags : [String],
  icon : {type : String, default: DEFAUL_ICON_PATH}, 
  programmes : [ProgrammeSchema]
});

module.exports = ChannelSchema;
