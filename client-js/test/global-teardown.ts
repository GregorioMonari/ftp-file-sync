/* eslint-disable @typescript-eslint/ban-ts-comment */
import dockerCompose from 'docker-compose';
import isCI from 'is-ci';
//

export default async function () {
  if (isCI) {
    dockerCompose.down();
  } else {
    if (Math.ceil(Math.random() * 5) === 5) {
      console.log('Cleaning up the database');
      // Clean up the database every once in a while
      // this implies that the tests should not rely on the data being there
      //TODO: CLEAN UP FTP
    }
  }
}
