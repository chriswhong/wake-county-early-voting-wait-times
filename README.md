# wake-county-early-voting-wait-times

An experimental node.js script that pulls data from a shared airtable view of early voting location estimated wait times in Wake County, NC ([Airtable](https://airtable.com/shrv4d2kjiDLp8maX/tblH5c7yZKTXW74jQ)) appends a lat/lon for each location, commits a version to the qri dataset [qri-cron-bot/wake-county-early-voting-wait-times](https://qri.cloud/qri-cron-bot/wake-county-early-voting-wait-times), and pushes the dataset to qri.cloud.

Once pushed to cloud, a csv of the dataset body can be used to make a visualization in kepler.gl.

![Messages Image(1376444317)](https://user-images.githubusercontent.com/1833820/96779358-68524900-13ba-11eb-99ff-c2ea58f1901d.png)

## Extracting data from an airtable shared view

This script uses puppeteer (headless chrome browser) to load the airtable shared view and get ahold of the XHR call for the raw data.  Then a few steps are necessary to transform the data into a 2D structure (array of objects) which can be easily exported to CSV for the qri commit.  See `fetchAirtableData()` in `script.js` to see how to unpack the raw airtable data.

## Running with Docker

The script is intended to run on a schedule.  The commit step will only result in a new version if there is a change in the CSV, so every 5 minutes a cron job executes a `docker run` command.  The docker container environment has `qri` CLI available, node.js, and all of the lower-level dependencies needed to run puppeteer.

The `.qri` directory for the qri profile that owns the dataset is passed into the container as a volume, along with this directory containing the node script.

To build the image:
```
docker build . -t qri-node-puppeteer
```
To run the container (which will automatically run `node /node/script.js`):
```
docker run -v /path/to/qri/repo:/qri -v /path/to/node/script:/node qri-node-puppeteer
```

To get an interactive terminal in the running container (to run `qri setup` manually, for example):
```
docker run -v /path/to/qri/repo:/qri -v /path/to/node/script:/node -it qri-node-puppeteer /bin/bash
```
