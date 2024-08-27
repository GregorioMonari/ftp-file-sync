import { path as rootPath } from 'app-root-path';
//import detectPort from 'detect-port';
import dockerCompose from 'docker-compose';
import * as dotenv from 'dotenv';
//import axios from 'axios';
import { setTimeout } from 'timers/promises';
import OpenPortsFinder from '../src/app/discovery/OpenPortsFinder';

export default async function () {
  console.time('global-setup');
  console.log('\n');

  dotenv.config({
    path: `${process.cwd()}/test.env`,
  });

  // TODO: get the port from the .env file
  //const dbPort = 21;

  // Speed up during development, if already live then do nothing
  //const reachablePort = await detectPort(21);
  const finder= new OpenPortsFinder(300);
  const ftpAlreadyPresent = await finder.checkPort("localhost",21);

  if (ftpAlreadyPresent) {
    console.warn(`There is already a service listening on port ${21}`);
    console.warn('Skipping the db configuration phase\n');
    return;
  }
  try {
    await dockerCompose.upAll({
      cwd: `${rootPath}/test`,
      log: true,
      env: process.env,
    });
  } catch (error) {
    console.error(
      'Error starting the db; Is your docker engine up and running?',
    );
    throw error;
  }

  console.log('Waiting for the db to be ready...');

  let retries = 0;
  let res:undefined|boolean = undefined;
  while (!res && retries < 5) {
    try {
      console.log('Waiting for the db to be ready...');
      await setTimeout(1000);
      //res = await axios.get(`http://localhost:${dbPort}/echo`);
      res = await finder.checkPort("localhost",21);
    } catch (error) {
    } finally {
      retries++;
    }
  }

  if (retries === 5) {
    throw new Error('The db is not ready');
  }

  console.timeEnd('global-setup');
  console.log('\n');
}
