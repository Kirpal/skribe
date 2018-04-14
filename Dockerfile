FROM node
RUN mkdir /usr/src/app
WORKDIR /usr/src/app
ADD package.json /usr/src/app
RUN npm install
ADD index.js /usr/src/app
ADD src /usr/src/app/src
ADD gulpfile.js /usr/src/app
RUN npm run build
CMD ["npm", "run", "start"]
