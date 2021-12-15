import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import minimist from 'minimist'
import { Logging } from './lib/logging.js'
import { help } from './lib/help.js'
import * as base from './lib/base.js'
import * as ut from './lib/utils.js'
import * as file from './lib/file.js'
import { Document } from './lib/document.js'

const opts = minimist(process.argv.slice(2), {
  alias: {
    help: 'h',
    base: 'b',
    file: 'f',
    period: 'p',
    compress: 'c',
    act: 'a',
    invoice: 'i',
    account: 't',
    notice: 'n',
  },
})

global.appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const fileLog = `${appRoot}/log/invoice-rss.log`
const pathSource = `${appRoot}/source`
const pathResult = `${appRoot}/result`

const logging = new Logging(fileLog)
const log = logging.add.bind(logging)

const main = async () => {
  log(`cmd: ${ut.getCommandLine()}`)

  if (Boolean(opts.help) || !Boolean(opts.period) || (!Boolean(opts.base) && !Boolean(opts.file))) {
    console.log(help)
    process.exit(1)
  }

  if (Boolean(opts.base)) {
    await mainBase(opts.period)
  }

  log('.')
}

async function mainBase(period) {
  // данные по по Книге счетов и Клиентам получаем из базы
  const book = await base.getBook(period)
  const customersId = ut.getCustomersId(book)
  const customers = await base.getCustomers(customersId)
  const services = await base.getServices(period)

  const bookf = await base.getBookFiz(period)
  const personsId = ut.getPersonsId(bookf)
  const persons = await base.getPersons(personsId)
  const servicesf = await base.getServicesFiz(period)

  // console.log(bookf)
  // console.log(personsId)
  // console.log(persons)
  // console.log(servicesFiz)

  // объекты с данными отображаем в csv-файлы
  const items = [
    [book, 'book.csv'],
    [Object.values(customers), 'customers.csv'],
    [services, 'services.csv'],
    [bookf, 'bookf.csv'],
    [Object.values(persons), 'persons.csv'],
    [servicesf, 'servicesf.csv'],
  ]

  // сохраняем
  items.forEach((f) => {
    const filename = path.resolve(pathSource, period, `${period}_${f[1]}`)
    const rows = file.writeFile({ file: filename, data: f[0] })
    log(`write ${rows} rows in file: ${path.basename(filename)}`)
  })

  const doc = new Document({ period, book, customers, services, bookf, persons, servicesf, pathResult })

  if (opts.account) {
    const result = await doc.createAccounts()
    resume('accounts', result)
  }

  if (opts.act) {
    const result = await doc.createActs()
    resume('acts', result)
  }

  if (opts.invoice) {
    const result = await doc.createInvoices()
    resume('invoices', result)
  }

  if (opts.notice) {
    const result = await doc.createNotices()
    resume('notices', result)
  }
}

function resume(what, result) {
  log(`create ${result.totalDocuments} ${what}, sum: ${result.totalSum.toFixed(2)}`)
}

main()
