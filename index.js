import express from 'express';
import { createHash } from 'crypto';

let workerCount = 2;
let data = [];
const processor = {};
const simulatedDB = {};

const handleQueue = (...args) => {
  console.log('Array updated', ...args);

  // get first value in array using shift
  const urlToProcess = data.shift();
  const urlId = md5Hash(urlToProcess);
  console.log('Processing', urlToProcess);

  // create processor entry
  processor[urlId] = {
    id: urlId,
    url: urlToProcess,
    state: 'processing',
  };
  console.log('added entry to processor', processor[urlId]);

  // pass it to the worker
  simulatedWorker(urlToProcess);
  console.log('passed url to worker', urlToProcess);

  // set timeout if the worker doesn't respond in time (by checking processor state)
  setTimeout(() => {
    if (processor[urlId]?.state === 'processing' || !processor[urlId]) {
      // put back in the queue
      data.push(urlToProcess);
      console.log('!!! timeout reached, putting back in queue !!!', urlToProcess);
    }
    // clean processsor entry --- if it's not done (timeout passed), put it back in the queue, if it's done, just remove it
    delete processor[urlId];
  }, 6000);

};

const randomTimeMs = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const md5Hash = (string) => {
  return createHash('md5').update(string).digest('hex');
};

const simulatedWorker = async (url) => {
  // todo id
  // take out worker count
  workerCount -= 1;
  return new Promise((resolve, reject) => {
    const failureRandomness = randomTimeMs(0, 10);
    const timeout = failureRandomness >= 9 ? 6500 : randomTimeMs(1000, 3000);
    setTimeout(() => {
      // put data in the db,
      const urlId = md5Hash(url);
      simulatedDB[urlId] = {
        id: urlId,
        url,
        data: JSON.stringify({ content: '<html><title>crawled</title><body>hello</body></html>' }),
        updatedAt: new Date().getTime(),
      };
      console.log('worker database update', simulatedDB[urlId])

      // update processor state
      try {
        processor[urlId].state = 'done';
        console.log('Worker done', url);
      } catch (error) {
        console.log('Worker failed to process', url);
      }
      // put back worker count
      workerCount += 1;
      resolve(url);
    }, timeout);
  })
}

// start the show!
setInterval(() => {
  // if worker free
  // if data in queue
  if (workerCount && data.length) {
    handleQueue();
  }

  if (!workerCount) {
    // todo proper back off logic
    console.log('All workers busy, backing off ...');
  }

  if (!data.length) {
    console.log('Queue empty, waiting. ...');
  }
}, 500);

// Set up express server
const server = express();
const port = 3000;

server.use(express.json());

// Entry
server.get('/', (req, res) => {
  res.status(200).json('Data Aquisition Scheduler PoC');
})

// List current queue
server.get('/queue', (req, res) => {
  res.status(200).json(data);
})

// List current processor
server.get('/processor', (req, res) => {
  res.status(200).json(processor);
})

// List current simulated db
server.get('/db', (req, res) => {
  res.status(200).json(simulatedDB);
})

// Reset queue (to placeholder urls)
server.get('/reset', (req, res) => {
  // TODO Reset the data array;
  data.splice(0);
  res.status(200).json({ message: 'Queue reset' });
})

// Add more urls to queue
server.post('/add', (req, res) => {
  // TODO Add data array;
  // Need to use splice again, as observe doesn't work with concat
  // And push is kinda costly
  let requestData = req.body;
  requestData = Array.isArray(requestData) ? requestData : [];
  data.splice(data.length, 0, ...requestData);
  res.status(200).json({ message: 'URLs added', data: req.body });
})

// Start server
server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
