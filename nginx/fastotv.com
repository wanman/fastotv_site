upstream app_fastotv {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name fastotv.com fastotv;
    access_log /var/log/nginx/fastotv.log;
    return 301 https://$server_name$request_uri;

    # Redirect non-https traffic to https
    # if ($scheme != "https") {
    #     return 301 https://$host$request_uri;
    # } # managed by Certbot

}

server {
    server_name www.fastotv.com fastotv.com;
    access_log /var/log/nginx/fastotv.log;

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/fastotv.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/fastotv.com/privkey.pem; # managed by Certbot

    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    ssl_prefer_server_ciphers on;
    ssl_ciphers "EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH";
    ssl_ecdh_curve secp384r1;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    # Disable preloading HSTS for now.  You can use the commented out header line that includes
    # the "preload" directive if you understand the implications.
    # add_header Strict-Transport-Security "max-age=63072000; includeSubdomains; preload";
    # add_header Strict-Transport-Security "max-age=63072000; includeSubdomains";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    ssl_dhparam /etc/ssl/certs/dhparam.pem;

    location / {
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $http_host;
      proxy_set_header X-NginX-Proxy true;

      proxy_pass http://app_fastotv;
      proxy_redirect off;
    }
}
# https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-16-04
