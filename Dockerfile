FROM node:12.18

WORKDIR /app

COPY . /app
RUN npm install

ENTRYPOINT ["tail"]
CMD ["-f","/dev/null"]
