FROM fusionauth/fusionauth-app:1.18.7 AS builder

USER root

RUN mkdir -p static-temp
ADD static-assets/static-assets.zip /static-temp
RUN cd /static-temp && unzip static-assets.zip && rm static-assets.zip

FROM fusionauth/fusionauth-app:1.17.0
COPY --chown=fusionauth:fusionauth --from=builder /static-temp/ /usr/local/fusionauth/static-temp

RUN mkdir /usr/local/fusionauth/fusionauth-app/web/icons

RUN mv -v /usr/local/fusionauth/static-temp/images/* /usr/local/fusionauth/fusionauth-app/web/images
RUN mv -v /usr/local/fusionauth/static-temp/css/* /usr/local/fusionauth/fusionauth-app/web/css
RUN mv -v /usr/local/fusionauth/static-temp/js/* /usr/local/fusionauth/fusionauth-app/web/js
RUN mv -v /usr/local/fusionauth/static-temp/fonts/* /usr/local/fusionauth/fusionauth-app/web/fonts
RUN mv -v /usr/local/fusionauth/static-temp/icons/* /usr/local/fusionauth/fusionauth-app/web/icons

RUN rm -rf /usr/local/fusionauth/static-temp

EXPOSE 80
EXPOSE 443

COPY ./kickstart.json /usr/local/fusionauth/kickstart.json

# re-running command provided in image
# https://github.com/FusionAuth/fusionauth-containers/blob/master/docker/fusionauth/fusionauth-app/Dockerfile
CMD ["/usr/local/fusionauth/fusionauth-app/apache-tomcat/bin/catalina.sh", "run"]
