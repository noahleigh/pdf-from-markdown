const fs = require('fs')

const request = require('request')
const marked = require('marked')
const tmp = require('tmp')
const puppeteer = require('puppeteer')

// Function definitions

/**
 * Return the contents of a file over HTTP
 * @param {string} url - An HTTP URL to a file
 * @param {function} callback - A function that accepts the file contents
 */
const getBodyFromURL = function (url, callback) {
  request.get(url, (err, res, body) => {
    // Handle errors
    if (err) {
      throw err
    }
    if (res.statusCode !== 200) {
      throw Error('Status:', res.statusCode, url)
    }
    callback(body)
  })
}

/**
 * Return the contents of a local file
 * @param {string} path - Path to a file
 * @param {function} callback - A function that accepts the file contents
 */
const getBodyFromPath = function (path, callback) {
  fs.readFile(path, (err, data) => {
    if (err) throw err
    const body = data.toString('utf8')
    callback(body)
  })
}

/**
 * Put an HTML string into an HTML5 boilerplate under `.markdown-body` and
 * return the result. Uses GitHub markdown styling from https://github.com/sindresorhus/github-markdown-css
 * @param {string} htmlString
 * @returns {string}
 */
const insertIntoBoilerplate = function (htmlString) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="ie=edge">
      <title>Document</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/3.0.1/github-markdown.min.css" integrity="sha256-HbgiGHMLxHZ3kkAiixyvnaaZFNjNWLYKD/QG6PWaQPc=" crossorigin="anonymous" />
  </head>
  <body>
      <main class="markdown-body">
          ${htmlString}
      </main>
  </body>
  </html>
  `
}

/**
 * Save a Markdown string to a temporary HTML file and return the path.
 * The file will be styled using GitHub's Markdown style.
 * @param {string} body - Markdown text
 * @param {function} callback - A function that accepts the HTML file path
 */
const convertMarkdowntoHTMLFile = function (body, callback) {
  // Convert Markdown to HTML and wrap in boilerplate
  const htmlFromMarkdown = marked(body)
  const fullHtml = insertIntoBoilerplate(htmlFromMarkdown)

  // Make a temp file for the HTML
  tmp.file({postfix: '.html'}, (err, path) => {
    if (err) throw err

    // Populate the file
    fs.writeFile(path, fullHtml, (err) => {
      if (err) throw err
      callback(path)
    })
  })
}

/**
 * Generate a PDF file from an HTML file.
 * Uses Puppeteer: https://github.com/GoogleChrome/puppeteer
 * @param {string} htmlFilePath
 * @param {Object} pdfOptions Options for [`page.pdf()`](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions)
 * @returns {Promise<string>}
 */
const htmlFileToPDF = async function (htmlFilePath, pdfOptions) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(`file://${htmlFilePath}`, {waitUntil: 'networkidle2'})
  await page.pdf(pdfOptions)
  await browser.close()

  return pdfOptions.path
}

/**
 * Read a Markdown file and produce a PDF file from its contents.
 * The file will be styled using Github's style.
 * @param {string} inputPath - URL or local path to a Markdown file
 * @param {string} outputPath - Path to the final PDF file
 */
const main = function (inputPath, outputPath) {
  // Decide how we're gonna retrieve the file
  const fetchFunction = inputPath.startsWith('http') ? getBodyFromURL : getBodyFromPath

  // Get the file contents
  fetchFunction(inputPath, body => {
    // Make a temp HTML file from the file contents
    convertMarkdowntoHTMLFile(body, path => {
      // Render that HTML file to a PDF file
      htmlFileToPDF(path, {
        path: outputPath,
        format: 'letter',
        scale: 0.8,
        margin: {top: '0.25in', right: '0.5in', bottom: '0.25in', left: '0.5in'}
      })
    })
  })
}

// Command-line operation

if (require.main === module) {
  const argv = require('yargs')
    .usage('$0 <inputPath> <outputPath>', 'Convert a Markdown file to a PDF with GitHub styling', (yargs) => {
      yargs.positional('inputPath', {
        describe: 'Path/URL of a Markdown file',
        type: 'string'
      })
      yargs.positional('outputPath', {
        describe: 'Path of the output PDF file',
        type: 'string'
      })
    })
    .argv
  main(argv.inputPath, argv.outputPath)
}

module.exports = {'pdfFromMarkdown': main}
