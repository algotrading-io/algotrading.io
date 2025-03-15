describe('Subscription', () => {
    beforeEach(() => {
      cy.visit('/subscription')
    })
    it('Subscribe', () => {
        // Login and subscribe
        const card = '.ant-card';
        cy.login();
        cy.get(card).contains('/ month').parent().invoke('text').should('match', /^\$\d+\.?\d+ \/ month$/);
        cy.contains('button', 'Subscribe').click();
        cy.origin('https://checkout.stripe.com', () => {
          cy.on('uncaught:exception', (e) => {
            const { name } = e;
            if (name === 'IntegrationError') {
              return false;
            }
            return true;
          })

          cy.get('input[name="cardNumber"]').type('4242424242424242');
          const expiryYear = String(new Date().getFullYear() + 4).slice(-2);
          const expiryMonth = '01'
          cy.get('input[name="cardExpiry"]').type(`${expiryMonth}${expiryYear}`);
          cy.get('input[name="cardCvc"]').type('420');
          cy.get('input[name="billingName"]').type('Signals');
          cy.get('input[name="billingAddressLine1"]').type('1 Infinite Loop');
          cy.get('span').contains('Enter address manually').click();
          cy.get('input[name="billingLocality"]').type('Cupertino');
          cy.get('input[name="billingPostalCode"]').type('95014');
          cy.get('select[name="billingAdministrativeArea"').select('CA')
          cy.get('input[type="checkbox"]').uncheck()
          cy.wait(5000)
          cy.get('.SubmitButton').contains('span', 'Subscribe').click({force: true});
          cy.wait(15000)
        });

        // Cancel subscription through Billing page
        cy.get('.ant-ribbon').contains('Current Plan');
        cy.contains('button', 'Manage subscription').click();
        cy.origin('https://billing.stripe.com', () => {
          // cy.on('uncaught:exception', (e) => {
          //   const { name } = e;
          //   if (name === 'IntegrationError') {
          //     return false;
          //   }
          //   return true;
          // })
          cy.get('a').contains('span', 'Cancel subscription').click();
          cy.contains('button', 'Cancel subscription').click();
          cy.contains('button', 'No thanks').click();
          cy.contains('span', 'Return to').click();
        });
        
        // Try contact us link
        cy.get('a').contains('Contact us!').click();
        cy.url().should('eq', 'https://dev.forcepu.sh/contact');
    })
  })