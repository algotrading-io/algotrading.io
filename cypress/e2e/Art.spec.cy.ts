describe('Art', () => {
    beforeEach(() => {
      cy.visit('/art')
    })
    it('Art Cards', () => {
      const card = '.ant-card';
      // Disabling bc NFTE is down permanently
      // cy.get(card).find('.ant-card-head-title').contains('A Cube');
      // cy.contains(card, 'A Cube').find('video').find('source').should('have.attr', 'src').should('include', 'Pak/ACube.mp4');
    })
  })