#!/usr/bin/env node
import 'babel-polyfill';
import inquirer from 'inquirer';
import {argv} from 'yargs';
import url from 'url';
import path from 'path';
import fs from 'fs';
import denodeify from 'denodeify';
import cheerio from 'cheerio';
import request from 'request-promise';
import del from 'del';
const lstat = denodeify(fs.lstat);
const writeFile = denodeify(fs.writeFile);
const readFile = denodeify(fs.readFile);

const config = path.join(__dirname, '..', 'renotes.json');

const main = async () => {
  let remoteURL;
  let configStat;
  try {
    configStat = await lstat(config);
  } catch (err) {
    if (typeof configStat === 'undefined' || !configStat.isFile()) remoteURL = await getRemoteURL();
  }
  try {
    if (remoteURL) await updateConfig(remoteURL);
    const configData = JSON.parse(await readFile(config));
    const output = Object.keys(configData.remotes).map((remote, idx) => {
      return `[i=${idx}] | [n=${remote}] : ${configData.remotes[remote]}`;
    });
    output.forEach(remote => console.log(remote));
  } catch (err) {
    console.log(err);
  }
};

const updateConfig = async uri => {
  try {
    const reqOpts = { method: 'GET', uri, encoding: 'utf8' };
    const $ = cheerio.load(await request(reqOpts));
    const rawGist = $('.file-actions').children('a.btn.btn-sm').attr('href');
    const gistURL = url.resolve(uri, rawGist);
    const gistContent = JSON.parse(await request({ ...reqOpts, uri: gistURL }));
    await writeFile(config, JSON.stringify({gist: uri, remotes: gistContent}));
    return JSON.parse(gistContent);
  } catch (err) {
    console.log(err);
  }
};

const getRemoteURL = () => {
  const prompt = [{
    type: 'input',
    name: 'gist',
    message: 'gist id?'
  }];
  return new Promise(resolve => {
    inquirer.prompt(prompt, answers => {
      writeFile(config, JSON.stringify({gist: answers.gist}))
        .then(() => {
          resolve(answers.gist);
        })
        .catch(err => {
          console.log(err);
        });
    });
  });
};

const setRemoteURL = async uri => {
  try {
    await writeFile(config, JSON.stringify({gist: uri}));
    return;
  } catch (err) {
    console.log(err);
  }
};

(async () => {
  try {
    if (argv.n) {
      const configData = JSON.parse(await readFile(config));
      console.log(configData.remotes[argv.n]);
      return;
    } else if (argv.i || typeof argv.i !== 'undefined') {
      const configData = JSON.parse(await readFile(config));
      Object.keys(configData.remotes).forEach((remote, idx) => {
        if (argv.i === idx) {
          console.log(configData.remotes[remote]);
          return;
        }
      });
      return;
    } else if (argv.set) {
      await setRemoteURL(argv.set);
      return;
    } else if (argv.clean) {
      await del(config);
      return;
    } else {
      main();
    }
  } catch (err) {
    console.log(err);
  }
})();
