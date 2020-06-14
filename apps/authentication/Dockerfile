FROM fusionauth/fusionauth-app:1.17.0

EXPOSE 80
EXPOSE 443

COPY --chown=fusionauth:fusionauth ./kickstart.json /usr/local/fusionauth/kickstart.json

# re-running command provided in image
# https://github.com/FusionAuth/fusionauth-containers/blob/master/docker/fusionauth/fusionauth-app/Dockerfile
CMD ["/usr/local/fusionauth/fusionauth-app/apache-tomcat/bin/catalina.sh", "run"]
