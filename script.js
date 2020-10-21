// use puppeteer to extract data from a shared airtable view
// join the data with data from a static JSON file
// commit the resulting data to a qri dataset
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const ObjectsToCsv = require('objects-to-csv')

const earlyVotingLookup = require('./early-voting-lookup')
const qri = require('./node-qri')

const AIRTABLE_VIEW_URL = 'https://airtable.com/shrv4d2kjiDLp8maX/tblH5c7yZKTXW74jQ'

// temp directory for storing a CSV to be committed to qri
const TEMP_DIR = './tmp'

async function fetchAirtableData() {
  return new Promise(async (resolve) => {
    // Create headless session
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox'
      ]
    })
    const page = await browser.newPage()

    // check the url of each response to identify the one we are interested in
    page.on('response', response => {
      if (response._request._url.includes('readSharedViewData')) {
        response.text().then((textBody) => {
          const { data: { table } } = JSON.parse(textBody)
          resolve(table)
        })
      }
    })

    // Open a page, than close
    await page.goto(AIRTABLE_VIEW_URL, {
      waitUntil: ['networkidle2', 'load', 'domcontentloaded'],
      timeout: 100000
    })
    await page.close()
    await browser.close()
  })
}

function transformAirtableData(airtableData) {
  const { columns, rows } = airtableData

  const selectColumnKeys = columns.filter(d => d.type === 'select').map(d => d.id)
  return rows.map((d) => {
    const rawRowObject = d.cellValuesByColumnId
    let rowObject = {}
    Object.keys(rawRowObject).forEach((key) => {
      let value = rawRowObject[key]

      // if this is a select column, lookup the value in the column definition
      if (selectColumnKeys.includes(key)) {
        const { choices } = columns.find(d => d.id === key).typeOptions
        value = choices[value].name
      }

      // lookup column name
      const columnName = columns.find(d => d.id === key).name
      rowObject[columnName] = value
    })
    return rowObject
  })
}

// lookup the polling place name, get the corresponding lat/lon
function joinWithSpatialData(rows) {
  return rows.map((row) => {
    const { longitude, latitude } = earlyVotingLookup.find(d => d.name === row['Wake County Early Voting Site'])

    return {
      ...row,
      longitude,
      latitude
    }
  })
}


// based on https://github.com/puppeteer/puppeteer/issues/794
async function main() {
    // fetch data
    const airtableData = await fetchAirtableData(AIRTABLE_VIEW_URL)
    // convert to array of objects
    const asObjects = transformAirtableData(airtableData)

    // join with spatial data
    const withSpatialData = joinWithSpatialData(asObjects)

    // save a CSV in the tmp directory
    const csv = new ObjectsToCsv(withSpatialData)
    if (!fs.existsSync(TEMP_DIR)){
      fs.mkdirSync(TEMP_DIR);
    }
    const bodyFilename = 'body.csv'
    await csv.toDisk(`${TEMP_DIR}/${bodyFilename}`)

    // qri save
    const bodyPath = path.resolve(__dirname, `${TEMP_DIR}/${bodyFilename}`)
    await qri.save('me/wake-county-early-voting-wait-times', {
      body: bodyPath
    })

    // qri push
    await qri.publish('me/wake-county-early-voting-wait-times')
}

main()
