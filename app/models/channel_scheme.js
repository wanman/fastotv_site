// load the things we need
var mongoose = require('mongoose');

var DEFAUL_ICON_PATH = '/images/unknown_channel.png';

// define the schema for our channel model
var ChannelSchema = mongoose.Schema({
  url : String,
  name : String,
  price : {type : Number, default: 0},
  tags : [String],
  icon : {type : String, default: DEFAUL_ICON_PATH} 
});

module.exports = ChannelSchema;
