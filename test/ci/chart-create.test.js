const request = require('supertest');
const assert = require('assert');
const db = require('../../lib/db');
const app = require('../../index');
describe('Chart API Tests', function() {
  this.timeout(6000);
  let chartId;

  it('should create a new chart', function(done) {
    request(app)
      .post('/chart/create')
      .send({
        chart: {
          options: { title: { display: true, text: 'Chart Title' } },
          type: 'bar',
          data: {
            labels: ['A', 'B'],
            datasets: [{ data: [10, 20] }],
          },
        },
        neverExpire: true,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          console.error(err);
          return done(err);
        }

        assert.strictEqual(res.body.success, true);
        chartId = res.body.url.split('/').pop(); // Витягуємо ID графіка
        done();
      });
  });

  it('should retrieve the created chart', function(done) {
    request(app)
      .get(`/chart/render/${chartId}`)
      .expect(200, done);
  });

  it('should return 404 for non-existent chart', function(done) {
    request(app)
      .get('/chart/render/nonexistent-id')
      .expect(404, done);
  });

  it('should apply template overrides', function(done) {
    request(app)
      .get(`/chart/render/${chartId}?title=TestTitle&labels=X,Y&data1=30,40`)
      .expect(200, done);
  });

  after(function(done) {
    db.run('DELETE FROM charts WHERE id = ?', [chartId]);
    db.close(done);
  });
});
