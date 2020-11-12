process.env.TESTENV = true

let product = require('../app/models/product.js')
let User = require('../app/models/user')

const crypto = require('crypto')

let chai = require('chai')
let chaiHttp = require('chai-http')
let server = require('../server')
chai.should()

chai.use(chaiHttp)

const token = crypto.randomBytes(16).toString('hex')
let userId
let productId

describe('products ', () => {
  const productParams = {
    title: '13 JavaScript tricks SEI instructors don\'t want you to know',
    text: 'You won\'believe number 8!'
  }

  before(done => {
    product.deleteMany({})
      .then(() => User.create({
        email: 'caleb',
        hashedPassword: '12345',
        token
      }))
      .then(user => {
        userId = user._id
        return user
      })
      .then(() => product.create(Object.assign(productParams, {owner: userId})))
      .then(record => {
        productId = record._id
        done()
      })
      .catch(console.error)
  })

  describe('GET /products ', () => {
    it('should get all the products ', done => {
      chai.request(server)
        .get('/products ')
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.products .should.be.a('array')
          res.body.products .length.should.be.eql(1)
          done()
        })
    })
  })

  describe('GET /products /:id', () => {
    it('should get one product', done => {
      chai.request(server)
        .get('/products /' + productId)
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.product.should.be.a('object')
          res.body.product.title.should.eql(productParams.title)
          done()
        })
    })
  })

  describe('DELETE /products /:id', () => {
    let productId

    before(done => {
      product.create(Object.assign(productParams, { owner: userId }))
        .then(record => {
          productId = record._id
          done()
        })
        .catch(console.error)
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .delete('/products /' + productId)
        .set('Authorization', `Bearer notarealtoken`)
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should be succesful if you own the resource', done => {
      chai.request(server)
        .delete('/products /' + productId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('should return 404 if the resource doesn\'t exist', done => {
      chai.request(server)
        .delete('/products /' + productId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(404)
          done()
        })
    })
  })

  describe('POST /products ', () => {
    it('should not POST an product without a title', done => {
      let noTitle = {
        text: 'Untitled',
        owner: 'fakedID'
      }
      chai.request(server)
        .post('/products ')
        .set('Authorization', `Bearer ${token}`)
        .send({ product: noTitle })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not POST an product without text', done => {
      let noText = {
        title: 'Not a very good product, is it?',
        owner: 'fakeID'
      }
      chai.request(server)
        .post('/products ')
        .set('Authorization', `Bearer ${token}`)
        .send({ product: noText })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not allow a POST from an unauthenticated user', done => {
      chai.request(server)
        .post('/products ')
        .send({ product: productParams })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should POST an product with the correct params', done => {
      let validproduct = {
        title: 'I ran a shell command. You won\'t believe what happened next!',
        text: 'it was rm -rf / --no-preserve-root'
      }
      chai.request(server)
        .post('/products ')
        .set('Authorization', `Bearer ${token}`)
        .send({ product: validproduct })
        .end((e, res) => {
          res.should.have.status(201)
          res.body.should.be.a('object')
          res.body.should.have.property('product')
          res.body.product.should.have.property('title')
          res.body.product.title.should.eql(validproduct.title)
          done()
        })
    })
  })

  describe('PATCH /products /:id', () => {
    let productId

    const fields = {
      title: 'Find out which HTTP status code is your spirit animal',
      text: 'Take this 4 question quiz to find out!'
    }

    before(async function () {
      const record = await product.create(Object.assign(productParams, { owner: userId }))
      productId = record._id
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .patch('/products /' + productId)
        .set('Authorization', `Bearer notarealtoken`)
        .send({ product: fields })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should update fields when PATCHed', done => {
      chai.request(server)
        .patch(`/products /${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ product: fields })
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('shows the updated resource when fetched with GET', done => {
      chai.request(server)
        .get(`/products /${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          res.body.product.title.should.eql(fields.title)
          res.body.product.text.should.eql(fields.text)
          done()
        })
    })

    it('doesn\'t overwrite fields with empty strings', done => {
      chai.request(server)
        .patch(`/products /${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ product: { text: '' } })
        .then(() => {
          chai.request(server)
            .get(`/products /${productId}`)
            .set('Authorization', `Bearer ${token}`)
            .end((e, res) => {
              res.should.have.status(200)
              res.body.should.be.a('object')
              // console.log(res.body.product.text)
              res.body.product.title.should.eql(fields.title)
              res.body.product.text.should.eql(fields.text)
              done()
            })
        })
    })
  })
})
