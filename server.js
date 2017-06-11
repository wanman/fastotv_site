// server.js

function gen_routing_key(platform, arch) {
  return platform + '_' + arch;
}

// load configs
var configDB = require('./config/database.js');
var settings_config = require('./config/settings.js');
var auth_config = require('./config/auth.js'); 
var root_abs_path = __dirname; 
var public_dir_abs_path = root_abs_path + '/public';
var public_downloads_dir_abs_path = public_dir_abs_path + '/downloads';
var public_downloads_users_dir_abs_path = public_downloads_dir_abs_path + '/users';
// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = settings_config.http_server_port;
var mongoose = require('mongoose');
var crypto = require('crypto');
var nev = require('email-verification')(mongoose);
var redis = require('redis');
var passport = require('passport');
var flash    = require('connect-flash');
var amqp = require('amqp');
var mkdirp = require('mkdirp');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');


app.redis_connection = redis.createClient();
app.redis_connection.on("error", function (err) {
    console.error(err);
});
// app_r

var http = require('http');
var io = require('socket.io');
var server = http.createServer(app);
var listener = io.listen(server);

// settings
app.locals.site = {
    title: 'FastoTV',
    version: '0.1.0',
    domain: 'http://fastotv.com',
    keywords: 'FastoTV, IPTV, Open source, Free, Tv player, Cross-platform',
    description: 'FastoTV it is open source iptv solution.',
    small_description: 'FastoTV - cross-platform solution for watching tv.',
    large_description: 'FastoTV — is a cross-platform, open source iptv solution in which you can watch TV after registration.',
    public_directory: public_dir_abs_path,
    users_directory: public_downloads_users_dir_abs_path,
    google_analitics_token: settings_config.google_analitics_token,
    data_ad_client: settings_config.data_ad_client,
    data_ad_slot: settings_config.data_ad_slot,
    github_link: 'https://github.com/fastogt/fastotv',
    github_issues_link: 'https://github.com/fastogt/fastotv/issues',
    github_link_without_host: 'fastogt/fastotv',
    twitter_name: 'FastoTV',
    twitter_link: 'https://twitter.com/FastoTV',
    facebook_appid: auth_config.facebookAuth.clientID,
    support_email : settings_config.support_email,
    support_email_password : settings_config.support_email_password
};
app.locals.project = {
    name: 'FastoTV',
    name_lowercase: 'fastotv',
    version: settings_config.app_version,
    version_type: settings_config.app_version_type
};
app.locals.author = {
    name: 'Topilski Alexandr',
    contact: 'atopilski@fastogt.com'
};
app.locals.company = {
    name: 'FastoGT',
    description: 'Fasto Great Technology',
    domain: 'http://fastogt.com',
    copyright: 'Copyright © 2014-2017 FastoGT. All rights reserved.'
};

app.locals.back_end = {
    socketio_port : settings_config.socketio_port,
    pub_sub_channel_in : settings_config.pub_sub_channel_in,
    pub_sub_channel_out : settings_config.pub_sub_channel_out,
    pub_sub_channel_client_state : settings_config.pub_sub_channel_client_state
};

// rabbitmq
var rabbit_connection = amqp.createConnection({ 
                                                host: settings_config.rabbitmq_host, 
                                                login: settings_config.rabbitmq_login,
                                                password: settings_config.rabbitmq_password
                                             });
rabbit_connection.on('error', function (err) {
  console.error("rabbit_connection.on:", err);
});

listener.on('connection', function (socket) {
  socket.on('subscribe_redis', function (data) {
    console.log('subscribe_redis', data.channel);
    socket.join(data.channel);
  });

  socket.on('publish_redis', function (msg) {
    redis_pub.publish(app.locals.back_end.pub_sub_channel_in, msg);
  });
 
  socket.on('publish_rabbitmq', function (msg) {
    var in_json = JSON.parse(msg);
        
    var user_package_dir = public_downloads_users_dir_abs_path + '/' + in_json.email;
    mkdirp(user_package_dir, function(err) {
      if (err) {
        console.error(err);
        socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': 100, 'message': err.message } ); //
        socket.emit('message_rabbitmq', { 'email': in_json.email, 'error': err.message });
        return;
      }
            
      socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': 0, 'message': 'Send request to build server' } ); //

      var rpc = new (require('./app/amqprpc'))(rabbit_connection);
      var branding_variables = '-DUSER_LOGIN=' + in_json.email + ' -DUSER_PASSWORD=' + in_json.password;
      var config = in_json.config;
      if (config.hasOwnProperty("hwaccel")) {
        var hwaccel_method = config.hwaccel;
        branding_variables += ' -DCONFIG_HWACCEL_METHOD=' + hwaccel_method;
      }
      if (config.hasOwnProperty("poweroffonexit")) {
        var poweroffonexit = config.poweroffonexit;
        branding_variables += ' -DCONFIG_POWER_OFF_ON_EXIT=' + poweroffonexit ? 'ON' : 'OFF';
      }
      if (config.hasOwnProperty("vf")) {
        var vf_string = config.vf;
        branding_variables += ' -DCONFIG_VF_SCALE=' + vf_string;
      }
      var request_data_json = {
        'branding_variables': branding_variables,
        'package_type' : in_json.package_type,
        'destination' : user_package_dir
      };
      var routing_key = gen_routing_key(in_json.platform, in_json.arch);
      console.log("request_data_json", request_data_json);
      console.log("routing_key", routing_key);

      rpc.makeRequest(routing_key, in_json.email, request_data_json, function response(err, response) {
      if (err) {
        console.error(err);
        socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': 100, 'message': err.message } ); //
        socket.emit('message_rabbitmq', { 'email': in_json.email, 'error': err.message });
        return;
      }
                
      var responce_json = response;
        console.log("response", responce_json);
        if(response.hasOwnProperty('error')){
          socket.emit('message_rabbitmq', { 'email': in_json.email, 'error': response.error });
        } else {
          var public_path = response.body.replace(public_dir_abs_path, '');
          socket.emit('message_rabbitmq', { 'email': in_json.email, 'body': app.locals.site.domain + public_path } );
        }
      }, 
      function status(response) {
        socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': response.progress, 'message': response.status } ); //
      });
    });
  });
});

var redis_sub = redis.createClient();
var redis_pub = redis.createClient();

redis_sub.on('error', function (err) {
  console.error(err);
});

redis_pub.on('error', function (err) {
  console.error(err);
});

redis_sub.on('ready', function() {
  redis_sub.subscribe(app.locals.back_end.pub_sub_channel_out, app.locals.back_end.pub_sub_channel_client_state);
});

redis_sub.on('message', function(channel, message){
  var resp = {'text': message, 'channel':channel};
  listener.in(channel).emit('message', resp);
});

// configuration ===============================================================
mongoose.Promise = global.Promise;
mongoose.connect(configDB.url); // connect to our database

// NEV configuration =====================
// our persistent user model
var User = require('./app/models/user');
var myHasher = function(password, tempUserData, insertTempUser, callback) {
  var hash = crypto.createHash('md5').update(password).digest('hex');
  return insertTempUser(hash, tempUserData, callback);
};

nev.configure({
  persistentUserModel: User,
  expirationTime: 600, // 10 minutes

  verificationURL: app.locals.site.domain + '/email-verification/${URL}',
  transportOptions: {
    service: 'Gmail',
    auth: {
      user: app.locals.site.support_email,
      pass: app.locals.site.support_email_password
    }
  },
  verifyMailOptions: {
      from: 'Do Not Reply <'+ app.locals.site.support_email +'>',
      subject: 'Please confirm account',
      html: 'Click the following link to confirm your account:</p><p>${URL}</p>',
      text: 'Please confirm your account by clicking the following link: ${URL}'
  },

  hashingFunction: myHasher,
  passwordFieldName: 'local.password',
}, function(err, options) {
  if (err) {
    console.log(err);
    return;
  }

  console.log('configured: ' + (typeof options === 'object'));
});

nev.generateTempUserModel(User, function(err, tempUserModel) {
  if (err) {
    console.log(err);
    return;
  }

  console.log('generated temp user model: ' + (typeof tempUserModel === 'function'));
});

require('./config/passport')(nev, app.redis_connection, passport); // pass passport for configuration

// set up our express application
app.use(express.static(public_dir_abs_path));
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({ secret: app.locals.project.name_lowercase })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport, nev); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('Http server ready for requests');
server.listen(app.locals.back_end.socketio_port);
