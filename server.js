// server.js

function gen_routing_key(device, platform, arch) {
  return device + '_' + platform + '_' + arch;
}

// load configs
var config_db = require('./config/database.js');
var public_settings_config = require('./config/public_settings.js');
var settings_config = require('./config/settings.js');
var auth_config = require('./config/auth.js');
var root_abs_path = __dirname;
var public_dir_abs_path = root_abs_path + '/public';
var public_downloads_dir_abs_path = public_dir_abs_path + '/downloads';
var public_downloads_users_dir_abs_path = public_downloads_dir_abs_path + '/users';
// set up ======================================================================
// get all the tools we need
var express = require('express');
var app = express();
var port = public_settings_config.http_server_port;
var mongoose = require('mongoose');
var nev = require('email-verification')(mongoose);
var redis = require('redis');
var passport = require('passport');
var flash = require('connect-flash');
var amqp = require('amqp');
var mkdirp = require('mkdirp');
var file_upload = require('express-fileupload');

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var fs = require('fs');

app.redis_connection = redis.createClient();
app.redis_connection.on("error", function (err) {
  console.error(err);
});
// app_r

var https = require('https');
var server = https.createServer({
  key: fs.readFileSync(settings_config.ssl_key_path),
  cert: fs.readFileSync(settings_config.ssl_cert_path)
}, app);
var io = require('socket.io');
var listener = io.listen(server);

// settings
app.locals.site = {
  title: public_settings_config.site_title,
  version: public_settings_config.site_version,
  domain: public_settings_config.site_domain,
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
  support_email_service_host: settings_config.support_email_service_host,
  support_email_service_port: settings_config.support_email_service_port,
  support_email_service_secure: settings_config.support_email_service_secure,
  support_email: settings_config.support_email,
  support_email_password: settings_config.support_email_password
};
app.locals.project = {
  name: public_settings_config.app_title,
  name_lowercase: public_settings_config.app_lowercase,
  version: public_settings_config.app_version,
  version_type: public_settings_config.app_version_type
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
  socketio_port: public_settings_config.socketio_port,
  pub_sub_channel_in: settings_config.pub_sub_channel_in,
  pub_sub_channel_out: settings_config.pub_sub_channel_out,
  pub_sub_channel_client_state: settings_config.pub_sub_channel_client_state
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

function SessionController(user) {
  // session controller class for storing redis connections
  // this is more a workaround for the proof-of-concept
  // in "real" applications session handling should NOT
  // be done like this
  this.sub = redis.createClient();
  this.pub = redis.createClient();

  this.user = user;
}

SessionController.prototype.subscribe = function (socket) {
  this.sub.on('message', function (channel, message) {
    socket.emit(channel, message);
  });
  var current = this;
  this.sub.on('subscribe', function (channel, count) {
    var joinMessage = JSON.stringify({action: 'control', user: current.user, msg: ' joined the channel'});
    current.publish(joinMessage);
  });
  this.sub.subscribe('chat');
};

SessionController.prototype.rejoin = function (socket, message) {
  this.sub.on('message', function (channel, message) {
    socket.emit(channel, message);
  });
  var current = this;
  this.sub.on('subscribe', function (channel, count) {
    var rejoin = JSON.stringify({action: 'control', user: current.user, msg: ' rejoined the channel'});
    current.publish(rejoin);
    var reply = JSON.stringify({action: 'message', user: message.user, msg: message.msg});
    current.publish(reply);
  });
  this.sub.subscribe('chat');
};

SessionController.prototype.unsubscribe = function () {
  this.sub.unsubscribe('chat');
};

SessionController.prototype.publish = function (message) {
  this.pub.publish('chat', message);
};

SessionController.prototype.destroyRedis = function () {
  if (this.sub !== null) this.sub.quit();
  if (this.pub !== null) this.pub.quit();
};

listener.on('connection', function (socket) {
  socket.on('post_to_chat', function (data) { // receiving chat messages
    var msg = JSON.parse(data);
    socket.get('sessionController', function (err, sessionController) {
      if (sessionController === null) {
        // implicit login - socket can be timed out or disconnected
        var newSessionController = new SessionController(msg.channel_id);
        socket.set('sessionController', newSessionController);
        newSessionController.rejoin(socket, msg);
      } else {
        var reply = JSON.stringify({action: 'message', channel: msg.channel_id, user: msg.user, msg: msg.msg});
        sessionController.publish(reply);
      }
    });
    // just some logging to trace the chat data
    console.log(data);
  });

  socket.on('join_chat', function (data) {
    var msg = JSON.parse(data);
    var sessionController = new SessionController(msg.channel_id);
    socket.set('sessionController', sessionController);
    sessionController.subscribe(socket);
    // just some logging to trace the chat data
    console.log(data);
  });

  socket.on('subscribe_redis', function (data) {
    console.log('subscribe_redis', data.channel);
    socket.join(data.channel);
  });

  socket.on('publish_redis', function (msg) {
    redis_pub.publish(app.locals.back_end.pub_sub_channel_in, msg);
  });

  socket.on('publish_rabbitmq', function (msg) {
    var in_json = JSON.parse(msg);

    var user_package_dir = public_downloads_users_dir_abs_path + '/' + in_json.email + '/' + in_json.device;
    mkdirp(user_package_dir, function (err) {
      if (err) {
        console.error(err);
        socket.emit('status_rabbitmq', {'email': in_json.email, 'progress': 100, 'message': err.message}); //
        socket.emit('message_rabbitmq', {'email': in_json.email, 'error': err.message});
        return;
      }

      socket.emit('status_rabbitmq', {
        'email': in_json.email,
        'progress': 0,
        'message': 'Send request to build server'
      }); //

      var rpc = new (require('./app/amqprpc'))(rabbit_connection);
      var branding_variables = '-DUSER_LOGIN=' + in_json.email + ' -DUSER_PASSWORD=' + in_json.password + ' -DUSER_DEVICE_ID=' + in_json.device_id;
      var config = in_json.config;
      if (config.hasOwnProperty("hwaccel")) {
        var hwaccel_method = config.hwaccel;
        branding_variables += ' -DCONFIG_HWACCEL_METHOD=' + hwaccel_method;
      }
      if (config.hasOwnProperty("width")) {
        branding_variables += ' -DCONFIG_WIDTH=' + config.width;
      }
      if (config.hasOwnProperty("height")) {
        branding_variables += ' -DCONFIG_HEIGHT=' + config.height;
      }
      if (config.hasOwnProperty("poweroffonexit")) {
        var poweroffonexit = config.poweroffonexit;
        var on_off_str = poweroffonexit ? 'ON' : 'OFF';
        branding_variables += ' -DCONFIG_POWER_OFF_ON_EXIT=' + on_off_str;
      }
      var request_data_json = {
        'branding_variables': branding_variables,
        'package_type': in_json.package_type,
        'destination': user_package_dir
      };
      var routing_key = gen_routing_key(in_json.device, in_json.platform, in_json.arch);
      console.log("request_data_json", request_data_json);
      console.log("routing_key", routing_key);

      rpc.makeRequest(routing_key, in_json.email, request_data_json, function response(err, response) {
          if (err) {
            console.error(err);
            socket.emit('status_rabbitmq', {'email': in_json.email, 'progress': 100, 'message': err.message}); //
            socket.emit('message_rabbitmq', {'email': in_json.email, 'error': err.message});
            return;
          }

          var responce_json = response;
          console.log("response", responce_json);
          if (response.hasOwnProperty('error')) {
            socket.emit('message_rabbitmq', {'email': in_json.email, 'error': response.error});
          } else {
            var public_path = response.body.replace(public_dir_abs_path, '');
            socket.emit('message_rabbitmq', {
              'email': in_json.email,
              'body': app.locals.site.domain + public_path
            });
          }
        },
        function status(response) {
          socket.emit('status_rabbitmq', {
            'email': in_json.email,
            'progress': response.progress,
            'message': response.status
          }); //
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

redis_sub.on('ready', function () {
  redis_sub.subscribe(app.locals.back_end.pub_sub_channel_out, app.locals.back_end.pub_sub_channel_client_state);
});

redis_sub.on('message', function (channel, message) {
  var resp = {'text': message, 'channel': channel};
  listener.in(channel).emit('message', resp);
});

// configuration ===============================================================
mongoose.Promise = global.Promise;
mongoose.connect(config_db.url); // connect to our database

// NEV configuration =====================
// our persistent user model
var User = require('./app/models/user');

nev.configure({
  persistentUserModel: User,
  expirationTime: 3600 * 24, // 10 minutes

  verificationURL: app.locals.site.domain + '/email-verification/${URL}',
  transportOptions: {
    host: app.locals.site.support_email_service_host,
    port: app.locals.site.support_email_service_port,
    secure: app.locals.site.support_email_service_secure, // secure:true for port 465, secure:false for port 587
    auth: {
      user: app.locals.site.support_email,
      pass: app.locals.site.support_email_password
    }
  },
  verifyMailOptions: {
    from: 'Do Not Reply <' + app.locals.site.support_email + '>',
    subject: 'Please confirm account',
    html: 'Click the following link to confirm your account:</p><p>${URL}</p>',
    text: 'Please confirm your account by clicking the following link: ${URL}'
  },

  emailFieldName: 'email',
  passwordFieldName: 'password',
}, function (err, options) {
  if (err) {
    console.log(err);
    return;
  }

  console.log('configured: ' + (typeof options === 'object'));
});

nev.generateTempUserModel(User, function (err, tempUserModel) {
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
app.use(bodyParser.urlencoded({extended: true}));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
  secret: app.locals.project.name_lowercase,
  resave: true,
  saveUninitialized: true
})); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

app.use(file_upload());

// routes ======================================================================
require('./app/routes.js')(app, passport, nev); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('Https server ready for requests');
server.listen(app.locals.back_end.socketio_port);
