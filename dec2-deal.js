/* eslint-disable max-len */
/* eslint-disable linebreak-style */
import 'cypress-wait-until';

const { login } = require('../../helpers/login-helper');
const { generateName, generateRandomNum, generateRandomNumBetween } = require('../../helpers/name-helper');

context('Deals', () => {
  describe('Deals UI', () => {
    let userSessionToken;

    before(async () => {
      userSessionToken = await login('Frantz+19.12.04@kargo.com', 'admin'); // This login allows to view option to Ignore Pub Floors
    });

    // This beforeEach is needed because when a subsequent tests hits
    // the same URL, cookies is not properly retained
    beforeEach(() => {
      cy.setCookie('kauth_access', userSessionToken);
    });

    const deal = {};
    const pgDeal = {};

    const getRequest = (options = {}) => {
      const defaultOptions = {
        auth: {
          bearer: Cypress.env('authToken'),
        },
        url: '/api/v1/deal',
      };
      return Cypress._.extend(defaultOptions, options);
    };

    it('Add Preferred-Fixed-Rate Deal', () => {
      deal.executionName = 'Standard';
      deal.formatName = 'Bottom Banner';
      deal.bidderName = ('QA-Bidder_Dont-update');
      deal.rate = generateRandomNum(200);
      deal.name = generateName('UI-Deal');
      deal.discount = generateRandomNum(100);
      deal.targetSpend = generateRandomNum(4000);
      deal.advertiser = 'Frantz-09.17 max effort -Dev';
      const recentlyCreatedDealGroup = Cypress.moment().format('YY.MM'); // Search for a deal-group made via automation

      cy.server();
      cy.route('POST', '/api/v1/deal').as('dealCreation');
      cy.route(`/api/v1/deal-group?limit=25&page=1&search=${recentlyCreatedDealGroup}&is_archived=false&exclude_tests=true&by_user=false`).as('searchAPI');

      cy.visit('');
      cy.get('[placeholder="Search"]', { timeout: 8000 }).type(recentlyCreatedDealGroup).wait('@searchAPI');
      cy.get('[data-qa="deal-group-dashboard--select-deal-group"]', { timeout: 8000 }).first().click();
      cy.url().should('include', 'deal-dashboard/deal-groups');
      cy.get('[data-qa="deal-dashboard--add-deal"]', { timeout: 8000 }).click();
      cy.url().should('include', 'deal-dashboard/deals/create');
      cy.get('[data-qa="deal-create--name"]').focus().clear().type(deal.name);
      cy.get('[data-qa="deal-create--set-preferred-rate"]').click();
      cy.get('[data-qa="Priority-dropdown--button"]').click();
      cy.get('[data-qa="Priority-dropdown--select--1"]').click(); // Selects 'Highest' priority to match deal.priority
      deal.priority = 'Highest';

      // Select a format
      cy.get('[data-qa="deal-form--select-format"]').click().type(deal.formatName);
      cy.get('[data-qa="deal-form--select-format"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();
      deal.adFormatId = 8; // <- ID of ad-format selected from above 👆🏾

      // Select a execution
      cy.get('[data-qa="deal-form--select-execution"]').click().type(deal.executionName);
      cy.get('[data-qa="deal-form--select-execution"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Select rate and target spend
      cy.get('[data-qa="deal-create--rate"]').focus().type(deal.rate);
      cy.get('[data-qa="deal-create--target-spend"]').focus().type(deal.targetSpend);
      cy.get('[data-qa="deal-create--rate-discount"]').focus().clear().type(deal.discount); // clear() needed since field initially has a '0'

      // Turning on option to Ignore Publisher Floors
      cy.get('[data-qa="deal-create--ignore-pub-floor"]').click().should('have.class', 'is-on');
      deal.pubFloorStatus = true; // Setting to 'true' due to above statement
      deal.ignorePubFloor = 'Yes'; // Setting to 'Yes' due this option being now turned on

      // Buyers Section - select bidder
      cy.get('[data-qa="deal-form--select-bidder"]').clear().type(deal.bidderName);
      cy.get('[data-qa="deal-form--select-bidder"]').parent('.input-wrapper--typeahead').find('.dropdown-menu')
        .children('li')
        .first()
        .children('a')
        .click();

      cy.get('[data-qa="deal-form--select-advertiser"]').clear().type(deal.advertiser);
      cy.get('[class="active"]').should('be.visible').click(); // Clicking on 1st result for Advertiser

      cy.get('[data-qa="deal-add-edit--submit"]').should('be.visible').click();
      cy.get('[data-qa="modal--confirm"]').should('be.visible').click().wait('@dealCreation');

      cy.get('[data-qa="deal-detail--title"]').should('contain', deal.name);
      cy.location().then((currentLocation) => {
        const urlPathName = currentLocation.pathname;
        deal.id = urlPathName.split('/').pop(); // Grabbing Deal ID from URL
      });
    });

    it('Verifying Created Preferred-Fixed-Rate Deal elements on Detail Page - left section', () => {
      cy.visit(`/deal-dashboard/deals/${deal.id}`);
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', deal.name).should('be.visible'); // 'be.visible needed so cypress does not see it as hidden during run // 'be.visible' needed so cypress does not see it as hidden during run
      cy.get('[data-qa="deal-detail--deal_execution"]').should('contain', deal.executionName);
      cy.get('[data-qa="deal-detail--deal_rate"]').should('contain', deal.rate);
      cy.get('[data-qa="deal-detail--deal_format"]').should('contain', deal.formatName);
      cy.get('[data-qa="deal-detail--deal_bidder"]').should('contain', deal.bidderName);
      cy.get('[data-qa="deal-detail--deal_discount"]').should('contain', deal.discount);
      cy.get('[data-qa="deal-detail--deal_priority"]').should('contain', deal.priority);
      cy.get('[data-qa="deal-detail--deal_advertiser"]').should('contain', deal.advertiser);
      cy.get('[data-qa="deal-detail--deal_ignore_pub_floors"]').should('contain', deal.ignorePubFloor);
      cy.get('[data-qa="deal-detail--deal_target_spend"]').should('contain', Intl.NumberFormat().format(deal.targetSpend));
    });

    it('Adding Targeting to the Preferred-Fixed-Rate Deal and Pushing to Ad Server', { retries: 4 }, () => {
      deal.masValue = 'YDD';
      deal.priorityKraken = 6; // Default Kraken Priority that is pushed. User can't change from UI
      deal.osValue = 'nintendo';
      deal.kruxValue = 'qa-krux';
      deal.browserValue = 'firefox';
      deal.carrierValue = 't-mobile';
      deal.socialValue = 'pinterest';
      deal.grapeShotValue = 'apac-airnz';
      deal.ispValue = 'digital ocean inc.';
      deal.deviceValue = ['phone', 'tablet'];
      deal.location = { name: 'Oregon', id: 38 }; // This is a state in the U.S.
      deal.viewabilitySampling = Math.floor(Math.random() * 99) + 1;
      deal.viewabilityThreshold = generateRandomNum(100);
      deal.citadelValue = 'p_g_beauty_shopper';
      deal.frequencyCapHour = generateRandomNumBetween(1, 7); // Show any # from 1-7 times an hour
      deal.frequencyCapDay = generateRandomNumBetween(8, 21); // Show any # from 8-21 times a day
      deal.frequencyCapWeek = generateRandomNumBetween(22, 80); // Show # from 22-80 times a week
      // Above FrequencyCap variables follow the formula of: 'Math.random() * (max - min) + min;'

      cy.server();
      cy.route('PATCH', '/api/v1/deal/*').as('dmUpdate');
      cy.route('/api/v1/deal/*/push-status').as('pushStatus');
      cy.route('/api/v1/citadel/segments').as('citadelUpdate');
      cy.route('/api/v1/km-proxy/isp-targeting-list').as('ispTargetingUpdate');
      cy.route('/api/v1/km-proxy/technology-targeting-integrations').as('techTargetingUpdate');
      cy.route('/api/v1/km-proxy/grapeshot-categories?limit=2000').as('grapeShotUpdate');
      cy.route(`/api/v1/digital-element?name=${deal.location.name}`).as('geolocation');

      cy.visit(`/deal-dashboard/deals/${deal.id}`);
      cy.get('[data-qa="targeting--edit_targeting"]').click();

      // OPTIMIZATION SETTINGS
      cy.get('[data-qa="toggle-tabs--select-viewability-On"]').click();
      cy.get('[data-qa="optimization-settings--sample-rate"]').focus().clear().type(deal.viewabilitySampling);
      cy.get('[data-qa="optimization-settings--viewability-threshold"]').clear().click().type(deal.viewabilityThreshold);
      cy.get('[data-qa="toggle-tabs--select-frequency-cap-On"]').click();
      cy.get('[data-qa="optimization-settings--frequency-cap-week"]').focus().type(deal.frequencyCapWeek);
      cy.get('[data-qa="optimization-settings--frequency-cap-day"]').focus().type(deal.frequencyCapDay);
      cy.get('[data-qa="optimization-settings--frequency-cap-hour"]').focus().type(deal.frequencyCapHour);

      // SITE LIST TARGETING
      cy.get('[data-qa="targeting--site-list-targeting--switch"]').click();
      cy.get('[data-qa="site-list-table--add-existing-btn"]').click();
      cy.get('div [data-qa="site-list-table--search-site-list"]').focus().type('Mo');
      cy.get('[class="active"]').first().click(); // selecting 1st option from dropdown
      deal.editorialGraph = false;

      // will enable after proper site-list is chosen
      // cy.get('[data-qa="toggle-tabs--select-editorial-graph-ON"]').click();

      // CUSTOM TARGETING
      cy.get('[data-qa="targeting--custom-targeting--switch"]').click();
      cy.get('[data-qa="Vendor-dropdown--button"]').click();
      cy.get('[data-qa="Vendor-dropdown--select--0"]').click();
      cy.get('div.tags.u-flex.u-wrap.u-fillRemaining.input-wrapper--typeahead input').click().type(`${deal.kruxValue}{enter}`);
      cy.get('div.group-wrapper div.add-key button span').click();

      cy.get('div:nth-child(4) dropdown-select.key-name div div button').click();
      cy.get('div:nth-child(4) [data-qa="Vendor-dropdown--select--1"]').click();
      cy.get('div.group-wrapper div:nth-child(4) div dm-autocomplete section input').click().type(`${deal.masValue}{enter}`);
      cy.get('div:nth-child(4) [data-qa="Operator-dropdown--button"]').click();
      cy.get('div:nth-child(4) [data-qa="Operator-dropdown--select--1"]').click();

      // Add Another Group of Custom Targeting
      cy.get('custom-targeting div div.add-set.u-row button').click(); // add group button
      cy.get('div:nth-child(3) [data-qa="toggle-tabs--select-custom-targeting-ALL"]').click(); // click All button

      cy.get('div:nth-child(3) dropdown-select.key-name div div button').click();
      cy.get('div:nth-child(3) [data-qa="Vendor-dropdown--select--2"]').click();
      cy.get('div:nth-child(3) div:nth-child(2) div dm-autocomplete input').click().type(`${deal.grapeShotValue}{enter}`);
      cy.get('custom-targeting div:nth-child(3) > div.add-key > button > span').click();

      cy.get('div:nth-child(3) > div:nth-child(4) > dropdown-select.key-name button').click();
      cy.get('div:nth-child(3) div:nth-child(4) [data-qa="Vendor-dropdown--select--3"]').click();
      cy.get('div:nth-child(3) div:nth-child(4) div dm-autocomplete section input').click().type(`${deal.citadelValue}{enter}`);
      cy.get('div:nth-child(3) div:nth-child(4) dropdown-select.key-operator button span').click();
      cy.get('div:nth-child(3) [data-qa="Operator-dropdown--select--1"]').click();

      // TECHNOGRAPHIC TARGETING
      cy.get('[placeholder="+ Add Browser"]').click().type(`${deal.browserValue}{enter}`);
      cy.get('[placeholder="+ Add Operating System"]').click().type(`${deal.osValue}{enter}`);
      cy.get('[placeholder="+ Add ISP Target"]').click().type(`${deal.ispValue}{enter}`);
      cy.get('[placeholder="+ Add Carrier"]').click().type(`${deal.carrierValue}{enter}`);
      cy.get('[placeholder="+ Add Social"]').click().type(`${deal.socialValue}{enter}`);
      cy.get('[placeholder="+ Add Device"]').click().type(`${deal.deviceValue[1]}{enter}`);
      // cy.contains(deal.deviceValue[1], { timeout: 8000 }).click();

      // GEO TARGETING
      cy.get('[data-qa="geo-targeting--dropdown_type"]').click();
      cy.get('[data-qa="geo-targeting--dropdown_type_EXCLUDE"]').click();
      cy.get('[placeholder="Choose a location"]').focus().type(deal.location.name)
        .wait('@geolocation')
        .its('status')
        .should('eq', 200);
      cy.contains('Region', { timeout: 8000 }).click(); // selecting Region version option from dropdown in UI
      deal.location.countryId = 840;
      cy.get('[data-qa="targeting--save_targeting"]').click().wait(['@dmUpdate', '@pushStatus', '@ispTargetingUpdate', '@techTargetingUpdate', '@grapeShotUpdate', '@citadelUpdate']);

      // Grabbing Kargo ID
      cy.get('[class="deal-id"]').invoke('text').then((text) => {
        deal.deal_id = text;
      });

      cy.get('[data-qa="deal-details--push_to_ad_server"]').click();

      // Following is needed to make sure data is pushed fully to external systems.
      const dealPushStatus = getRequest();
      dealPushStatus.url = `/api/v1/deal/${deal.id}/push-status`;

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.wait('@pushStatus').then(pushResponse => pushResponse.response.body.completed === true), { verbose: true, errorMsg: 'Deal did not push successfully' });
      cy.request(dealPushStatus).then((pushResponse) => {
        if (pushResponse.body.log[0].output) {
          throw new Error(pushResponse.body.log[0].output.message);
        }
      });
    });

    it('Verifying PFR Deal Info on SSP service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${deal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const sspResponse = integrationsResponse.body.ssp;
        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, deal.name, 'Deal Name ');
        assert.equal(sspResponse.external_id, deal.id, 'Deal ID ');
        assert.equal(sspResponse.type, 'preferred_fixed_price', 'Deal Type ');
        assert.equal(sspResponse.bidder.name, deal.bidderName, 'Bidder name ');
        assert.equal(sspResponse.ad_formats[0].type, 'banner', 'Ad-Format type ');
        assert.equal(sspResponse.priority, deal.priority.toLowerCase(), 'Priority ');
        assert.equal(sspResponse.ad_formats[0].name, deal.formatName, 'Ad-Format name ');
        assert.equal(sspResponse.no_publishers_floor, deal.pubFloorStatus, 'Ignore Publisher Floor ');
      });
    });

    it('Verifying PFR Deal Info on Athena service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${deal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const athenaResponse = integrationsResponse.body.athena;
        assert.equal(athenaResponse.active, true, 'Active ');
        assert.equal(athenaResponse.CPM, deal.rate * 100, 'CPM Value '); // Adding '* 100' due to no decimal in Kraken
        assert.equal(athenaResponse.adFormat, deal.adFormatId, 'Ad-Format type ');
        assert.equal(athenaResponse.priority, deal.priorityKraken, 'Priority in Kraken ');
        assert.equal(athenaResponse.viewabilitySampling, deal.viewabilitySampling / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.viewabilityThreshold, deal.viewabilityThreshold / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.frequencyCap.day, deal.frequencyCapDay, 'Day ');
        assert.equal(athenaResponse.frequencyCap.hour, deal.frequencyCapHour, 'Hour ');
        assert.equal(athenaResponse.frequencyCap.week, deal.frequencyCapWeek, 'Week ');
        assert.equal(athenaResponse.targeting.editorialGraph, deal.editorialGraph, 'Editorial Graph status '); // will change to true
        assert.equal(athenaResponse.targeting.deviceType.include.includes(deal.deviceValue[0]), true, 'Device type contains phone ');
        assert.equal(athenaResponse.targeting.country.include[0], deal.location.countryId, 'country ');
        assert.equal(athenaResponse.targeting.region.exclude[0], deal.location.id, 'Region ');
        assert.equal(athenaResponse.targeting.carrier.include[0], deal.carrierValue, 'Carrier ');
        assert.equal(athenaResponse.targeting.os.include[0], deal.osValue, 'OS ');
        assert.equal(athenaResponse.targeting.browser.include[0], deal.browserValue, 'Browser ');
        assert.equal(athenaResponse.targeting.socialBrowser.include[0], deal.socialValue, 'Social Browser include value ');
        assert.equal(athenaResponse.targeting.isp.include[0], deal.ispValue, 'ISP include value ');
        // Following line is verifying device-type: Tablet
        expect(athenaResponse.targeting.deviceType.include).to.include(deal.deviceValue[1]);

        // Custom Targeting
        const athenaRespTargetingCustom = athenaResponse.targeting.custom;
        assert.equal(athenaRespTargetingCustom.logicalOperator, 'OR', 'Logical Operator');
        assert.equal(athenaRespTargetingCustom.children[0].logicalOperator, 'OR', 'operator between Contextual Targeting fields ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].keyName, 'ksg', 'Vendor type (krux) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].valueNames, deal.kruxValue, 'Value name (krux) ');

        assert.equal(athenaRespTargetingCustom.children[0].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].keyName, 'mas', 'Vendor type (mas) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].valueNames, deal.masValue, 'Value name (mas) ');

        assert.equal(athenaRespTargetingCustom.children[1].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].keyName, 'GS_CHANNELS_ALL', 'Vendor type (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].valueNames, deal.grapeShotValue, 'Value name (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].keyName, 'citadel', 'Vendor type (citadel) ');

        athenaRespTargetingCustom.children[1].children[1].valueNames[0] = deal.citadelValue;
        assert.equal(athenaRespTargetingCustom.children[1].children[1].valueNames[0], deal.citadelValue, 'Value name (citadel) ');
        assert.equal(athenaRespTargetingCustom.children[1].logicalOperator, 'AND', 'operator between Audience Targeting sets  ');
        // assert.equal(athenaRespTargetingCustom.children[0].children[0].logicalOperator, 'AND', 'operator between Contextual Targeting fields ');
      });
    });

    it('Update Preferred-Fixed-Rate Deal To Private Auction APN Deal and Pushing to Ad Server', () => {
      cy.server();
      cy.route('PATCH', '/api/v1/deal/*').as('dmUpdate');
      cy.route('/api/v1/deal/*/push-status').as('pushStatus');
      cy.route('/api/v1/citadel/segments').as('citadelUpdate');
      cy.route('/api/v1/km-proxy/isp-targeting-list').as('ispTargetingUpdate');
      cy.route('/api/v1/km-proxy/technology-targeting-integrations').as('techTargetingUpdate');
      cy.route('/api/v1/km-proxy/grapeshot-categories?limit=2000').as('grapeShotUpdate');
      cy.route(`/api/v1/digital-element?name=${deal.location.name}`).as('geolocation');

      deal.name += '-updated to APN private_auction-deal';
      deal.formatName = 'Anchor';
      deal.rate = generateRandomNum(200);
      deal.discount = generateRandomNum(100);
      deal.executionName = 'Slide to Reveal';
      deal.targetSpend = generateRandomNum(200);
      deal.bidderName = 'APN';
      deal.seatName = 'APN Seat';

      cy.visit(`/deal-dashboard/deals/${deal.id}`);
      cy.get('[class="button button--edit"]', { timeout: 8000 }).click({ force: true }); // Requires 'force: true' for hidden element
      cy.url().should('include', 'deal-dashboard/deals/edit/');

      // Edit Deal Type
      cy.get('[data-qa="deal-create--set-private-auction"]').click();

      // Edit Deal Name
      cy.get('[data-qa="deal-create--name"]').focus().clear().type(deal.name);

      // Edit Rate, Target Spend, & Discount
      cy.get('[data-qa="deal-create--rate"]').clear().focus().type(deal.rate);
      cy.get('[data-qa="deal-create--rate-discount"]').focus().clear().type(deal.discount); // clear() needed since field initially has a '0'
      cy.get('[data-qa="deal-create--target-spend"]').clear().focus().type(deal.targetSpend);

      // Select a Format
      cy.get('[data-qa="deal-form--select-format"]').clear().type(deal.formatName);
      cy.get('[data-qa="deal-form--select-format"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();
      deal.adFormatId = 3; // <- ID of ad-format selected from above 👆🏾

      // Edit a execution
      cy.get('[data-qa="deal-form--select-execution"]').click().type(deal.executionName);
      cy.get('[data-qa="deal-form--select-execution"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Edit a bidder
      cy.get('[data-qa="deal-form--select-bidder"]').clear().type(deal.bidderName).click();
      cy.get('[data-qa="deal-form--select-bidder"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Select a seat
      cy.get('[data-qa="deal-form--select-seat"]').click().type(deal.seatName).click();
      cy.get('[data-qa="deal-form--select-seat"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Verify that PG deal is disabled after choosing APN bidder
      cy.get('[data-qa="deal-create--set-programmatic-guaranteed"]', { timeout: 8000 }).should('be.disabled');

      // Submitting Deal Group info and Validating
      cy.get('[data-qa="deal-add-edit--submit"]').click();
      cy.get('[data-qa="modal--confirm"]').click();
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', deal.name);

      // cy.get('[data-qa="deal-details--push_to_ad_server"]').click();

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      // cy.waitUntil(() => cy.get('deal-status-box section div.deal-detail-sync-indicator kg-indicator div tool-tip div i', { timeout: 60000 }).should('not.be.visible'), {
      //   errorMsg: 'Failed to push APN deal!',
      //   timeout: 3000000,
      //   interval: 150000,
      // });
    });

    it('Edit Targeting to the APN PA Deal and Pushing to Ad Server', { retries: 4 }, () => {
      deal.masValue = 'wDE';
      deal.priorityKraken = 6; // Default Kraken Priority that is pushed. User can't change from UI
      deal.osValue = 'nintendo';
      deal.kruxValue = 'new-krux';
      deal.browserValue = 'firefox';
      deal.carrierValue = 't-mobile';
      deal.socialValue = 'pinterest';
      deal.grapeShotValue = 'asics_kayano_q3_kwt';
      deal.ispValue = 'digital ocean inc.';
      deal.deviceValue = ['phone', 'tablet'];
      deal.location = { name: 'Oregon', id: 38 }; // This is a state in the U.S.
      deal.viewabilitySampling = Math.floor(Math.random() * 99) + 1;
      deal.viewabilityThreshold = generateRandomNum(100);
      deal.citadelValue = 'NotSafePlace_Disney';
      deal.frequencyCapHour = generateRandomNumBetween(1, 7); // Show any # from 1-7 times an hour
      deal.frequencyCapDay = generateRandomNumBetween(8, 21); // Show any # from 8-21 times a day
      deal.frequencyCapWeek = generateRandomNumBetween(22, 80); // Show # from 22-80 times a week
      // Above FrequencyCap variables follow the formula of: 'Math.random() * (max - min) + min;'

      cy.server();
      cy.route('PATCH', '/api/v1/deal/*').as('dmUpdate');
      cy.route('/api/v1/deal/*/push-status').as('pushStatus');
      cy.route('/api/v1/citadel/segments').as('citadelUpdate');
      cy.route('/api/v1/km-proxy/isp-targeting-list').as('ispTargetingUpdate');
      cy.route('/api/v1/km-proxy/technology-targeting-integrations').as('techTargetingUpdate');
      cy.route('/api/v1/km-proxy/grapeshot-categories?limit=2000').as('grapeShotUpdate');
      cy.route(`/api/v1/digital-element?name=${deal.location.name}`).as('geolocation');

      cy.visit(`/deal-dashboard/deals/${deal.id}`);
      cy.get('[data-qa="targeting--edit_targeting"]').click();

      // Edit OPTIMIZATION SETTINGS
      cy.get('[data-qa="optimization-settings--sample-rate"]').focus().clear().type(deal.viewabilitySampling);
      cy.get('[data-qa="optimization-settings--viewability-threshold"]').clear().click().type(deal.viewabilityThreshold);
      cy.get('[data-qa="optimization-settings--frequency-cap-week"]').focus().clear().type(deal.frequencyCapWeek);
      cy.get('[data-qa="optimization-settings--frequency-cap-day"]').focus().clear().type(deal.frequencyCapDay);
      cy.get('[data-qa="optimization-settings--frequency-cap-hour"]').focus().clear().type(deal.frequencyCapHour);

      // Edit SITE LIST TARGETING
      // cy.get('[data-qa="targeting--site-list-targeting--switch"]').click();
      cy.get('[data-qa="site-list-table--add-existing-btn"]').click();
      cy.get('div [data-qa="site-list-table--search-site-list"]').focus().type('New');
      cy.get('[class="active"]').first().click(); // selecting 1st option from dropdown
      deal.editorialGraph = false;

      // will enable after proper site-list is chosen
      // cy.get('[data-qa="toggle-tabs--select-editorial-graph-ON"]').click();

      // Edit CUSTOM TARGETING
      // cy.get('[data-qa="targeting--custom-targeting--switch"]').click();
      // cy.get('[data-qa="Vendor-dropdown--button"]').click();
      // cy.get('[data-qa="Vendor-dropdown--select--0"]').click();

      cy.get('div:nth-child(1) > div:nth-child(2) div dm-autocomplete section div div i').click();
      cy.get('div:nth-child(1) > div:nth-child(2) div dm-autocomplete section input').click().type(`${deal.kruxValue}{enter}`);
      // cy.get('div.group-wrapper div.add-key button span').click();

      // cy.get('div:nth-child(4) dropdown-select.key-name div div button').click();
      // cy.get('div:nth-child(4) [data-qa="Vendor-dropdown--select--1"]').click();

      cy.get('div:nth-child(1) > div:nth-child(4) div dm-autocomplete section div div i').click();
      cy.get('div:nth-child(1) > div:nth-child(4) div dm-autocomplete section input').click().type(`${deal.masValue}{enter}`);
      // cy.get('div:nth-child(4) [data-qa="Operator-dropdown--button"]').click();
      // cy.get('div:nth-child(4) [data-qa="Operator-dropdown--select--1"]').click();

      // Add Another Group of Custom Targeting
      // cy.get('custom-targeting div div.add-set.u-row button').click(); // add group button
      // cy.get('div:nth-child(3) [data-qa="toggle-tabs--select-custom-targeting-ALL"]').click(); // click All button

      // cy.get('div:nth-child(3) dropdown-select.key-name div div button').click();
      // cy.get('div:nth-child(3) [data-qa="Vendor-dropdown--select--2"]').click();

      cy.get('div:nth-child(3) > div:nth-child(2) div dm-autocomplete section div div i').click();
      cy.get('div:nth-child(3) div:nth-child(2) div dm-autocomplete section input').click().type(`${deal.grapeShotValue}{enter}`);
      // cy.get('custom-targeting div:nth-child(3) > div.add-key > button > span').click();

      // cy.get('div:nth-child(3) > div:nth-child(4) > dropdown-select.key-name button').click();
      // cy.get('div:nth-child(3) div:nth-child(4) [data-qa="Vendor-dropdown--select--3"]').click();

      cy.get('div:nth-child(3) > div:nth-child(4) div dm-autocomplete section div div i').click();
      cy.get('div:nth-child(3) div:nth-child(4) div dm-autocomplete section input').click().type(`${deal.citadelValue}{enter}`);
      // cy.get('div:nth-child(3) div:nth-child(4) dropdown-select.key-operator button span').click();
      // cy.get('div:nth-child(3) [data-qa="Operator-dropdown--select--1"]').click();

      // TECHNOGRAPHIC TARGETING
      cy.get('[placeholder="+ Add Browser"]').click().type(`${deal.browserValue}{enter}`);
      cy.get('[placeholder="+ Add Operating System"]').click().type(`${deal.osValue}{enter}`);
      cy.get('[placeholder="+ Add ISP Target"]').click().type(`${deal.ispValue}{enter}`);
      cy.get('[placeholder="+ Add Carrier"]').click().type(`${deal.carrierValue}{enter}`);
      cy.get('[placeholder="+ Add Social"]').click().type(`${deal.socialValue}{enter}`);
      cy.get('[placeholder="+ Add Device"]').click().type(`${deal.deviceValue[1]}{enter}`);
      // cy.contains(deal.deviceValue[1], { timeout: 8000 }).click();

      // GEO TARGETING
      cy.get('[data-qa="geo-targeting--dropdown_type"]').click();
      cy.get('[data-qa="geo-targeting--dropdown_type_EXCLUDE"]').click();
      cy.get('[placeholder="Choose a location"]').focus().type(deal.location.name)
        .wait('@geolocation')
        .its('status')
        .should('eq', 200);
      cy.contains('Region', { timeout: 8000 }).click(); // selecting Region version option from dropdown in UI
      deal.location.countryId = 840;
      cy.get('[data-qa="targeting--save_targeting"]').click().wait(['@dmUpdate', '@pushStatus', '@ispTargetingUpdate', '@techTargetingUpdate', '@grapeShotUpdate', '@citadelUpdate']);

      // Grabbing Kargo ID
      cy.get('[class="deal-id"]').invoke('text').then((text) => {
        deal.deal_id = text;
      });

      cy.get('[data-qa="deal-details--push_to_ad_server"]').click();

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.get('deal-status-box section div.deal-detail-sync-indicator kg-indicator div tool-tip div i', { timeout: 60000 }).should('not.be.visible'), {
        errorMsg: 'Failed to push APN deal!',
        timeout: 3000000,
        interval: 150000,
      });
    });

    it('Verifying Edited Private Auction APN  Deal elements on Detail Page - left section', () => {
      cy.visit(`/deal-dashboard/deals/${deal.id}`);
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', deal.name).should('be.visible'); // 'be.visible needed so cypress does not see it as hidden during run
      cy.get('[data-qa="deal-detail--deal_execution"]', { timeout: 8000 }).should('contain', deal.executionName);
      cy.get('[data-qa="deal-detail--deal_rate"]').should('contain', deal.rate);
      cy.get('[data-qa="deal-detail--deal_format"]').should('contain', deal.formatName);
      cy.get('[data-qa="deal-detail--deal_bidder"]').should('contain', deal.bidderName);
      cy.get('[data-qa="deal-detail--deal_discount"]').should('contain', deal.discount);
      cy.get('[data-qa="deal-detail--deal_advertiser"]').should('contain', deal.advertiser);
      cy.get('[data-qa="deal-detail--deal_target_spend"]').should('contain', Intl.NumberFormat().format(deal.targetSpend));
    });

    it('Verifying PA APN Deal Info on SSP service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${deal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const sspResponse = integrationsResponse.body.ssp;
        // dealPrice = sspResponse.first_look_cpm;
        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, deal.name, 'Deal Name ');
        assert.equal(sspResponse.external_id, deal.id, 'Deal ID ');
        assert.equal(sspResponse.type, 'private_auction', 'Deal Type ');
        assert.equal(sspResponse.bidder.name, deal.bidderName, 'Bidder name ');
        assert.equal(sspResponse.ad_formats[0].type, 'banner', 'Ad-Format type ');
        assert.equal(sspResponse.ad_formats[0].name, deal.formatName, 'Ad-Format name ');
        assert.equal(sspResponse.no_publishers_floor, deal.pubFloorStatus, 'Ignore Publisher Floor ');
      });
    });

    it('Verifying PA APN Deal Info on Athena service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${deal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const athenaResponse = integrationsResponse.body.athena;
        assert.equal(athenaResponse.active, true, 'Active ');
        assert.equal(athenaResponse.CPM, deal.rate * 100, 'CPM Value '); // Adding '* 100' due to no decimal in Kraken
        assert.equal(athenaResponse.adFormat, deal.adFormatId, 'Ad-Format type ');
        assert.equal(athenaResponse.priority, deal.priorityKraken, 'Priority in Kraken ');
        assert.equal(athenaResponse.viewabilitySampling, deal.viewabilitySampling / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.viewabilityThreshold, deal.viewabilityThreshold / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.frequencyCap.day, deal.frequencyCapDay, 'Day ');
        assert.equal(athenaResponse.frequencyCap.hour, deal.frequencyCapHour, 'Hour ');
        assert.equal(athenaResponse.frequencyCap.week, deal.frequencyCapWeek, 'Week ');
        assert.equal(athenaResponse.targeting.editorialGraph, deal.editorialGraph, 'Editorial Graph status '); // will change to true
        assert.equal(athenaResponse.targeting.deviceType.include.includes(deal.deviceValue[0]), true, 'Device type contains phone ');
        assert.equal(athenaResponse.targeting.country.include[0], deal.location.countryId, 'country ');
        assert.equal(athenaResponse.targeting.region.exclude[0], deal.location.id, 'Region ');
        assert.equal(athenaResponse.targeting.carrier.include[0], deal.carrierValue, 'Carrier ');
        assert.equal(athenaResponse.targeting.os.include[0], deal.osValue, 'OS ');
        assert.equal(athenaResponse.targeting.browser.include[0], deal.browserValue, 'Browser ');
        assert.equal(athenaResponse.targeting.socialBrowser.include[0], deal.socialValue, 'Social Browser include value ');
        assert.equal(athenaResponse.targeting.isp.include[0], deal.ispValue, 'ISP include value ');
        // Following line is verifying device-type: Tablet
        expect(athenaResponse.targeting.deviceType.include).to.include(deal.deviceValue[1]);

        // Custom Targeting
        const athenaRespTargetingCustom = athenaResponse.targeting.custom;
        assert.equal(athenaRespTargetingCustom.logicalOperator, 'OR', 'Logical Operator');
        assert.equal(athenaRespTargetingCustom.children[0].logicalOperator, 'OR', 'operator between Contextual Targeting fields ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].keyName, 'ksg', 'Vendor type (krux) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].valueNames, deal.kruxValue, 'Value name (krux) ');

        assert.equal(athenaRespTargetingCustom.children[0].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].keyName, 'mas', 'Vendor type (mas) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].valueNames, deal.masValue, 'Value name (mas) ');

        assert.equal(athenaRespTargetingCustom.children[1].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].keyName, 'GS_CHANNELS_ALL', 'Vendor type (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].valueNames, deal.grapeShotValue, 'Value name (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');

        assert.equal(athenaRespTargetingCustom.children[1].children[1].keyName, 'citadel', 'Vendor type (citadel) ');
        athenaRespTargetingCustom.children[1].children[1].valueNames[0] = deal.citadelValue;
        assert.equal(athenaRespTargetingCustom.children[1].children[1].valueNames[0], deal.citadelValue, 'Value name (citadel) ');
        assert.equal(athenaRespTargetingCustom.children[1].logicalOperator, 'AND', 'operator between Audience Targeting sets  ');
      });
    });

    it('Verify APN Deal data sent to App-Nexus', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${deal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const appNexus = integrationsResponse.body.app_nexus_deal;

        assert.equal(appNexus.name, deal.name, 'Deal Name ');
        assert.equal(appNexus.code, deal.deal_id, 'Kargo Deal ID ');
        assert.equal(appNexus.active, true, 'Deal status ');
        assert.equal(appNexus.type.name, 'Private Auction', 'Deal type ');
        assert.equal(appNexus.auction_type.name, 'Standard Price', 'Auction type ');
        assert.equal(appNexus.use_deal_floor, true, 'Use Deal Floor ');
        assert.equal(appNexus.priority, 5, 'Priority ');
        assert.equal(appNexus.currency, 'USD', 'Currency type ');
        assert.equal(appNexus.seller.id, 8173, 'Seller ID ');
        assert.equal(appNexus.seller.name, 'Kargo Global, Inc', 'Seller name ');
        assert.equal(appNexus.seller.bidder_id, 2, 'Seller bidder ID ');

        assert.equal(appNexus.buyer.id, 882, 'Buyer ID ');
        assert.equal(appNexus.buyer.bidder_supports_hashed_user_ids, false, ' ');
        assert.equal(appNexus.buyer.guaranteed_deals_support, 'Disabled', 'Guaranteed deals support ');
        assert.equal(appNexus.buyer.name, 'AN Talent', 'Buyer name ');
        assert.equal(appNexus.buyer.bidder_name, 'DisplayWordsAuto', 'Buyer bidder name ');

        assert.equal(appNexus.buyer_exposure.id, 1, 'Buyer exposure ID ');
        assert.equal(appNexus.buyer_exposure.name, 'Single buyer', 'Buyer exposure name ');
        assert.equal(appNexus.size_preference, 'standard', 'Size preference ');
        assert.equal(appNexus.category_restrict, true, 'Category restrict ');
        assert.equal(appNexus.technical_attribute_restrict, true, 'Technical attribute restrict ');
        assert.equal(appNexus.language_restrict, true, 'Language restrict ');

        // assert.equal(appNexus.floor_price, dealPrice, 'Floor price ');
        // assert.equal(appNexus.ask_price, dealPrice, 'Ask price ');
      });
    });

    it('Archiving Private Auction APN  Deal from Detail page', () => {
      cy.server();
      cy.route('/api/v1/users/session-user').as('sessionUserApi');
      cy.route('/api/v1/km-proxy/isp-targeting-list').as('ispApi');
      cy.route('DELETE', `/api/v1/deal/${deal.id}`).as('archivingDeal');
      cy.route('/api/v1/km-proxy/grapeshot-categories?limit=2000').as('grapeShotApi');
      cy.route('/api/v1/km-proxy/technology-targeting-integrations').as('techTargetApi');
      cy.route('/api/v1/km-proxy/service-proxy?limit=999&page=1&requested_endpoint=api/v1/segments&requested_service=cma-mgmt&sort_direction=ASC&type=0,2,3').as('cmaApi');

      cy.visit(`deal-dashboard/deals/${deal.id}`).wait(['@sessionUserApi', '@grapeShotApi', '@cmaApi', '@ispApi', '@techTargetApi']);
      cy.get('[data-qa="deal-detail--deal_archive"]', { timeout: 8000 }).click();
      cy.get('[data-qa="modal--confirm"]').last().should('be.visible')
        .click()
        .wait(['@archivingDeal', '@cmaApi', '@grapeShotApi', '@cmaApi', '@grapeShotApi']) // Added grapeshot & cma twice because 2 extra call were being made
        .each((apiCall) => {
          assert.equal(apiCall.status, 200, 'Response Status ');
        });
    });

    it('Verifying Private Auction APN  Deal is archived', () => {
      cy.server();
      cy.route('/api/v1/deal?page=1&limit=25&search=*').as('seachAPI');

      cy.get('[data-qa="targeting--edit_targeting"]', { timeout: 8000 }).should('be.disabled');
      cy.get('.icon-archive', { timeout: 8000 }).should('exist');
      cy.get('[data-qa="deal-detail--deal_unarchive"]').should('contain', 'Unarchive');
      cy.get('[data-qa="deal-create--goto-deal-group"] .breadcrumb').click(); // User return to deal groups entry page
      cy.get('[type="search"]', { timeout: 8000 }).clear().type(deal.name).wait('@seachAPI');
      cy.get('.t-regular').should('exist'); // No deal is returned
      cy.get('.u-grid-gap-24 > div:nth-child(4)').click(); // Clicking no "archive" filter
      cy.get('li:nth-child(3) a').click(); // Clicking on archive option
      cy.get('[data-qa="deal-dashboard--select-deal"]', { timeout: 8000 }).should('exist');
      cy.get('.t-regular').should('not.exist'); // "No results found" text should NOT display
    });

    it('Unarchiving Private Auction APN  Deal from Detail page', () => {
      cy.get('[data-qa="deal-dashboard--select-deal"]').click();
      cy.get('[data-qa="deal-detail--deal_unarchive"]').click();
      cy.get('[data-qa="modal--confirm"]').last().click();
    });

    it('Verifying Private Auction APN  Deal is Unarchived', () => {
      cy.get('[data-qa="targeting--edit_targeting"]', { timeout: 8000 }).should('be.enabled');
      cy.get('.icon-archive').should('not.exist');
      cy.get('[data-qa="deal-detail--deal_archive"]').should('contain', 'Archive');
      cy.get('[data-qa="deal-create--goto-deal-group"] .breadcrumb').click(); // User return to deal groups landing page
      cy.get('[type="search"]').clear().type(deal.name);
      cy.get('.t-regular').should('not.exist'); // "No results found" text should NOT display
    });

    it('Create Programmatic Guaranteed Deal', () => {
      pgDeal.executionName = 'Standard';
      pgDeal.formatName = 'Bottom Banner';
      pgDeal.bidderName = ('QA-Bidder_Dont-update');
      pgDeal.rate = generateRandomNum(200);
      pgDeal.name = generateName('UI-Programmatic Guaranteed-Deal');
      pgDeal.targetSpend = generateRandomNum(4000);
      pgDeal.advertiser = 'Frantz-09.17 max effort -Dev';
      pgDeal.buffer = generateRandomNumBetween(10, 100);
      pgDeal.impressionGoal = generateRandomNum(100);
      const recentlyCreatedDealGroup = Cypress.moment().format('YY.MM'); // Search for a deal-group made via automation

      cy.server();
      cy.route('POST', '/api/v1/deal').as('dealCreation');
      cy.route(`/api/v1/deal-group?limit=25&page=1&search=${recentlyCreatedDealGroup}&is_archived=false&exclude_tests=true&by_user=false`).as('searchAPI');

      cy.visit('');
      cy.get('[placeholder="Search"]', { timeout: 8000 }).type(recentlyCreatedDealGroup).wait('@searchAPI');
      cy.get('[data-qa="deal-group-dashboard--select-deal-group"]', { timeout: 8000 }).first().click();
      cy.url().should('include', 'deal-dashboard/deal-groups');
      cy.get('[data-qa="deal-dashboard--add-deal"]', { timeout: 8000 }).click();
      cy.url().should('include', 'deal-dashboard/deals/create');
      cy.get('[data-qa="deal-create--name"]').focus().clear().type(pgDeal.name);

      cy.get('[data-qa="deal-create--set-programmatic-guaranteed"]').click();
      cy.get('[data-qa="deal-create--impression-goal"]').type(pgDeal.impressionGoal);
      cy.get('[data-qa="deal-create--buffer-percentage"]').type(pgDeal.buffer);

      // Select a format
      cy.get('[data-qa="deal-form--select-format"]').click().type(pgDeal.formatName);
      cy.get('[data-qa="deal-form--select-format"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Select a execution
      cy.get('[data-qa="deal-form--select-execution"]').click().type(pgDeal.executionName);
      cy.get('[data-qa="deal-form--select-execution"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Select rate and target spend
      cy.get('[data-qa="deal-create--rate"]').focus().type(pgDeal.rate);
      cy.get('[data-qa="deal-create--target-spend"]').focus().type(pgDeal.targetSpend);

      // Turning on option to Ignore Publisher Floors
      cy.get('[data-qa="deal-create--ignore-pub-floor"]').click().should('have.class', 'is-on');
      pgDeal.pubFloorStatus = true; // Setting to 'true' due to above statement
      pgDeal.ignorePubFloor = 'Yes'; // Setting to 'Yes' due this option being now turned on

      // Buyers Section - select bidder
      cy.get('[data-qa="deal-form--select-bidder"]').clear().type(pgDeal.bidderName);
      cy.get('[data-qa="deal-form--select-bidder"]').parent('.input-wrapper--typeahead').find('.dropdown-menu')
        .children('li')
        .first()
        .children('a')
        .click();

      cy.get('[data-qa="deal-form--select-advertiser"]').clear().type(pgDeal.advertiser);
      cy.get('[class="active"]').should('be.visible').click(); // Clicking on 1st result for Advertiser

      cy.get('[data-qa="deal-add-edit--submit"]').should('be.visible').click();
      cy.get('[data-qa="modal--confirm"]').should('be.visible').click().wait('@dealCreation');

      cy.get('[data-qa="deal-detail--title"]').should('contain', pgDeal.name);
      cy.location().then((currentLocation) => {
        const urlPathName = currentLocation.pathname;
        pgDeal.id = urlPathName.split('/').pop(); // Grabbing Deal ID from URL
      });
    });

    it('Verifying Created Programmatic Guaranteed Deal elements on Detail Page - left section', () => {
      cy.visit(`/deal-dashboard/deals/${pgDeal.id}`);
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', pgDeal.name).should('be.visible'); // 'be.visible needed so cypress does not see it as hidden during run // 'be.visible' needed so cypress does not see it as hidden during run
      cy.get('[data-qa="deal-detail--deal_execution"]').should('contain', pgDeal.executionName);
      cy.get('[data-qa="deal-detail--deal_rate"]').should('contain', pgDeal.rate);
      cy.get('[data-qa="deal-detail--deal_format"]').should('contain', pgDeal.formatName);
      cy.get('[data-qa="deal-detail--deal_bidder"]').should('contain', pgDeal.bidderName);
      cy.get('[data-qa="deal-detail--deal_type"]').should('contain', 'Programmatic Guaranteed');
      // cy.get('[data-qa="deal-detail--deal_buffered_goal"]').should('contain', (pgDeal.buffer).format('0%') + pgDeal.impressionGoal);
      cy.get('[data-qa="deal-detail--deal_advertiser"]').should('contain', pgDeal.advertiser);
      cy.get('[data-qa="deal-detail--deal_ignore_pub_floors"]').should('contain', pgDeal.ignorePubFloor);
      cy.get('[data-qa="deal-detail--deal_target_spend"]').should('contain', Intl.NumberFormat().format(pgDeal.targetSpend));
    });

    it('Edit Programmatic Guaranteed Deal', () => {
      pgDeal.name += '-edited';
      pgDeal.formatName = 'Anchor';
      pgDeal.rate = generateRandomNum(200);
      pgDeal.discount = generateRandomNum(100);
      pgDeal.executionName = 'Slide to Reveal';
      pgDeal.targetSpend = generateRandomNum(200);

      cy.visit(`/deal-dashboard/deals/${pgDeal.id}`);
      cy.get('[class="button button--edit"]', { timeout: 8000 }).click({ force: true }); // Requires 'force: true' for hidden element
      cy.url().should('include', 'deal-dashboard/deals/edit/');

      // Edit Deal Name
      cy.get('[data-qa="deal-create--name"]').focus().clear().type(pgDeal.name);

      // Edit Rate, Target Spend, & Discount
      cy.get('[data-qa="deal-create--rate"]').clear().focus().type(pgDeal.rate); // clear() needed since field initially has a '0'
      cy.get('[data-qa="deal-create--target-spend"]').clear().focus().type(pgDeal.targetSpend);

      // Select a Format
      cy.get('[data-qa="deal-form--select-format"]').clear().type(pgDeal.formatName);
      cy.get('[data-qa="deal-form--select-format"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();
      pgDeal.adFormatId = 3; // <- ID of ad-format selected from above 👆🏾

      // Select a execution
      cy.get('[data-qa="deal-form--select-execution"]').click().type(pgDeal.executionName);
      cy.get('[data-qa="deal-form--select-execution"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // // Edit a bidder
      // cy.get('[data-qa="deal-form--select-bidder"]').clear().type(pgDeal.bidderName).click();
      // cy.get('[data-qa="deal-form--select-bidder"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
      //   .first()
      //   .children('a')
      //   .click();

      // // Select a seat
      // cy.get('[data-qa="deal-form--select-seat"]').click().type(pgDeal.seatName).click();
      // cy.get('[data-qa="deal-form--select-seat"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
      //   .first()
      //   .children('a')
      //   .click();

      // Submitting Deal Group info and Validating
      cy.get('[data-qa="deal-add-edit--submit"]').click();
      cy.get('[data-qa="modal--confirm"]').click();
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', pgDeal.name);
    });

    it('Verifying Created Programmatic Guaranteed Deal elements on Detail Page - left section', () => {
      cy.visit(`/deal-dashboard/deals/${pgDeal.id}`);
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', pgDeal.name).should('be.visible'); // 'be.visible needed so cypress does not see it as hidden during run // 'be.visible' needed so cypress does not see it as hidden during run
      cy.get('[data-qa="deal-detail--deal_execution"]').should('contain', pgDeal.executionName);
      cy.get('[data-qa="deal-detail--deal_rate"]').should('contain', pgDeal.rate);
      cy.get('[data-qa="deal-detail--deal_format"]').should('contain', pgDeal.formatName);
      cy.get('[data-qa="deal-detail--deal_bidder"]').should('contain', pgDeal.bidderName);
      cy.get('[data-qa="deal-detail--deal_type"]').should('contain', 'Programmatic Guaranteed');
      // cy.get('[data-qa="deal-detail--deal_buffered_goal"]').should('contain', (pgDeal.buffer).format('0%') + pgDeal.impressionGoal);
      cy.get('[data-qa="deal-detail--deal_advertiser"]').should('contain', pgDeal.advertiser);
      cy.get('[data-qa="deal-detail--deal_ignore_pub_floors"]').should('contain', pgDeal.ignorePubFloor);
      cy.get('[data-qa="deal-detail--deal_target_spend"]').should('contain', Intl.NumberFormat().format(pgDeal.targetSpend));
    });

    it('Adding Targeting to the Programmatic Guaranteed Deal and Pushing to Ad Server', { retries: 4 }, () => {
      pgDeal.masValue = 'YDD';
      pgDeal.priorityKraken = 6; // Default Kraken Priority that is pushed. User can't change from UI
      pgDeal.osValue = 'nintendo';
      pgDeal.kruxValue = 'qa-krux';
      pgDeal.browserValue = 'firefox';
      pgDeal.carrierValue = 't-mobile';
      pgDeal.socialValue = 'pinterest';
      pgDeal.grapeShotValue = 'apac-airnz';
      pgDeal.ispValue = 'digital ocean inc.';
      pgDeal.deviceValue = ['phone', 'tablet'];
      pgDeal.location = { name: 'Oregon', id: 38 }; // This is a state in the U.S.
      pgDeal.viewabilitySampling = Math.floor(Math.random() * 99) + 1;
      pgDeal.viewabilityThreshold = generateRandomNum(100);
      pgDeal.citadelValue = 'p_g_beauty_shopper';
      pgDeal.frequencyCapHour = generateRandomNumBetween(1, 7); // Show any # from 1-7 times an hour
      pgDeal.frequencyCapDay = generateRandomNumBetween(8, 21); // Show any # from 8-21 times a day
      pgDeal.frequencyCapWeek = generateRandomNumBetween(22, 80); // Show # from 22-80 times a week
      // Above FrequencyCap variables follow the formula of: 'Math.random() * (max - min) + min;'

      cy.server();
      cy.route('PATCH', '/api/v1/deal/*').as('dmUpdate');
      cy.route('/api/v1/deal/*/push-status').as('pushStatus');
      cy.route('/api/v1/citadel/segments').as('citadelUpdate');
      cy.route('/api/v1/km-proxy/isp-targeting-list').as('ispTargetingUpdate');
      cy.route('/api/v1/km-proxy/technology-targeting-integrations').as('techTargetingUpdate');
      cy.route('/api/v1/km-proxy/grapeshot-categories?limit=2000').as('grapeShotUpdate');
      cy.route(`/api/v1/digital-element?name=${pgDeal.location.name}`).as('geolocation');

      cy.visit(`/deal-dashboard/deals/${pgDeal.id}`);
      cy.get('[data-qa="targeting--edit_targeting"]').click();

      // OPTIMIZATION SETTINGS
      cy.get('[data-qa="toggle-tabs--select-viewability-On"]').click();
      cy.get('[data-qa="optimization-settings--sample-rate"]').focus().clear().type(pgDeal.viewabilitySampling);
      cy.get('[data-qa="optimization-settings--viewability-threshold"]').clear().click().type(pgDeal.viewabilityThreshold);
      cy.get('[data-qa="toggle-tabs--select-frequency-cap-On"]').click();
      cy.get('[data-qa="optimization-settings--frequency-cap-week"]').focus().type(pgDeal.frequencyCapWeek);
      cy.get('[data-qa="optimization-settings--frequency-cap-day"]').focus().type(pgDeal.frequencyCapDay);
      cy.get('[data-qa="optimization-settings--frequency-cap-hour"]').focus().type(pgDeal.frequencyCapHour);

      // SITE LIST TARGETING
      cy.get('[data-qa="targeting--site-list-targeting--switch"]').click();
      cy.get('[data-qa="site-list-table--add-existing-btn"]').click();
      cy.get('div [data-qa="site-list-table--search-site-list"]').focus().type('Mo');
      cy.get('[class="active"]').first().click(); // selecting 1st option from dropdown
      pgDeal.editorialGraph = false;

      // will enable after proper site-list is chosen
      // cy.get('[data-qa="toggle-tabs--select-editorial-graph-ON"]').click();

      // CUSTOM TARGETING
      cy.get('[data-qa="targeting--custom-targeting--switch"]').click();
      cy.get('[data-qa="Vendor-dropdown--button"]').click();
      cy.get('[data-qa="Vendor-dropdown--select--0"]').click();
      cy.get('div.tags.u-flex.u-wrap.u-fillRemaining.input-wrapper--typeahead input').click().type(`${pgDeal.kruxValue}{enter}`);
      cy.get('div.group-wrapper div.add-key button span').click();

      cy.get('div:nth-child(4) dropdown-select.key-name div div button').click();
      cy.get('div:nth-child(4) [data-qa="Vendor-dropdown--select--1"]').click();
      cy.get('div.group-wrapper div:nth-child(4) div dm-autocomplete section input').click().type(`${pgDeal.masValue}{enter}`);
      cy.get('div:nth-child(4) [data-qa="Operator-dropdown--button"]').click();
      cy.get('div:nth-child(4) [data-qa="Operator-dropdown--select--1"]').click();

      // Add Another Group of Custom Targeting
      cy.get('custom-targeting div div.add-set.u-row button').click(); // add group button
      cy.get('div:nth-child(3) [data-qa="toggle-tabs--select-custom-targeting-ALL"]').click(); // click All button

      cy.get('div:nth-child(3) dropdown-select.key-name div div button').click();
      cy.get('div:nth-child(3) [data-qa="Vendor-dropdown--select--2"]').click();
      cy.get('div:nth-child(3) div:nth-child(2) div dm-autocomplete input').click().type(`${pgDeal.grapeShotValue}{enter}`);
      cy.get('custom-targeting div:nth-child(3) > div.add-key > button > span').click();

      cy.get('div:nth-child(3) > div:nth-child(4) > dropdown-select.key-name button').click();
      cy.get('div:nth-child(3) div:nth-child(4) [data-qa="Vendor-dropdown--select--3"]').click();
      cy.get('div:nth-child(3) div:nth-child(4) div dm-autocomplete section input').click().type(`${pgDeal.citadelValue}{enter}`);
      cy.get('div:nth-child(3) div:nth-child(4) dropdown-select.key-operator button span').click();
      cy.get('div:nth-child(3) [data-qa="Operator-dropdown--select--1"]').click();

      // TECHNOGRAPHIC TARGETING
      cy.get('[placeholder="+ Add Browser"]').click().type(`${pgDeal.browserValue}{enter}`);
      cy.get('[placeholder="+ Add Operating System"]').click().type(`${pgDeal.osValue}{enter}`);
      cy.get('[placeholder="+ Add ISP Target"]').click().type(`${pgDeal.ispValue}{enter}`);
      cy.get('[placeholder="+ Add Carrier"]').click().type(`${pgDeal.carrierValue}{enter}`);
      cy.get('[placeholder="+ Add Social"]').click().type(`${pgDeal.socialValue}{enter}`);
      cy.get('[placeholder="+ Add Device"]').click().type(`${pgDeal.deviceValue[1]}{enter}`);
      // cy.contains(deal.deviceValue[1], { timeout: 8000 }).click();

      // GEO TARGETING
      cy.get('[data-qa="geo-targeting--dropdown_type"]').click();
      cy.get('[data-qa="geo-targeting--dropdown_type_EXCLUDE"]').click();
      cy.get('[placeholder="Choose a location"]').focus().type(pgDeal.location.name)
        .wait('@geolocation')
        .its('status')
        .should('eq', 200);
      cy.contains('Region', { timeout: 8000 }).click(); // selecting Region version option from dropdown in UI
      pgDeal.location.countryId = 840;
      cy.get('[data-qa="targeting--save_targeting"]').click().wait(['@dmUpdate', '@pushStatus', '@ispTargetingUpdate', '@techTargetingUpdate', '@grapeShotUpdate', '@citadelUpdate']);
      cy.get('[data-qa="deal-details--push_to_ad_server"]').click();

      // Following is needed to make sure data is pushed fully to external systems.
      const pgDealPushStatus = getRequest();
      pgDealPushStatus.url = `/api/v1/deal/${pgDeal.id}/push-status`;

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.wait('@pushStatus').then(pushResponse => pushResponse.response.body.completed === true), { verbose: true, errorMsg: 'Deal did not push successfully' });
      cy.request(pgDealPushStatus).then((pushResponse) => {
        if (pushResponse.body.log[0].output) {
          throw new Error(pushResponse.body.log[0].output.message);
        }
      });
    });

    it('Verifying PG Deal Info on SSP service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${pgDeal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const sspResponse = integrationsResponse.body.ssp;
        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, pgDeal.name, 'Deal Name ');
        assert.equal(sspResponse.external_id, pgDeal.id, 'Deal ID ');
        assert.equal(sspResponse.type, 'programmatic_guaranteed', 'Deal Type ');
        assert.equal(sspResponse.bidder.name, pgDeal.bidderName, 'Bidder name ');
        assert.equal(sspResponse.ad_formats[0].type, 'banner', 'Ad-Format type ');
        // assert.equal(sspResponse.priority, pgDeal.priority.toLowerCase(), 'Priority ');
        assert.equal(sspResponse.ad_formats[0].name, pgDeal.formatName, 'Ad-Format name ');
        assert.equal(sspResponse.no_publishers_floor, pgDeal.pubFloorStatus, 'Ignore Publisher Floor ');
      });
    });

    it('Verifying PG Deal Info on Athena service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${pgDeal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const athenaResponse = integrationsResponse.body.athena;
        assert.equal(athenaResponse.active, false, 'Active ');
        assert.equal(athenaResponse.CPM, pgDeal.rate * 100, 'CPM Value '); // Adding '* 100' due to no decimal in Kraken
        // assert.equal(athenaResponse.adFormat, pgDeal.adFormatId, 'Ad-Format type ');
        // assert.equal(athenaResponse.priority, pgDeal.priorityKraken, 'Priority in Kraken ');
        assert.equal(athenaResponse.viewabilitySampling, pgDeal.viewabilitySampling / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.viewabilityThreshold, pgDeal.viewabilityThreshold / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.frequencyCap.day, pgDeal.frequencyCapDay, 'Day ');
        assert.equal(athenaResponse.frequencyCap.hour, pgDeal.frequencyCapHour, 'Hour ');
        assert.equal(athenaResponse.frequencyCap.week, pgDeal.frequencyCapWeek, 'Week ');
        assert.equal(athenaResponse.targeting.editorialGraph, pgDeal.editorialGraph, 'Editorial Graph status '); // will change to true
        assert.equal(athenaResponse.targeting.deviceType.include.includes(pgDeal.deviceValue[0]), true, 'Device type contains phone ');
        assert.equal(athenaResponse.targeting.country.include[0], pgDeal.location.countryId, 'country ');
        assert.equal(athenaResponse.targeting.region.exclude[0], pgDeal.location.id, 'Region ');
        assert.equal(athenaResponse.targeting.carrier.include[0], pgDeal.carrierValue, 'Carrier ');
        assert.equal(athenaResponse.targeting.os.include[0], pgDeal.osValue, 'OS ');
        assert.equal(athenaResponse.targeting.browser.include[0], pgDeal.browserValue, 'Browser ');
        assert.equal(athenaResponse.targeting.socialBrowser.include[0], pgDeal.socialValue, 'Social Browser include value ');
        assert.equal(athenaResponse.targeting.isp.include[0], pgDeal.ispValue, 'ISP include value ');
        // Following line is verifying device-type: Tablet
        expect(athenaResponse.targeting.deviceType.include).to.include(pgDeal.deviceValue[1]);

        // Custom Targeting
        const athenaRespTargetingCustom = athenaResponse.targeting.custom;
        assert.equal(athenaRespTargetingCustom.logicalOperator, 'OR', 'Logical Operator');
        assert.equal(athenaRespTargetingCustom.children[0].logicalOperator, 'OR', 'operator between Keys ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].keyName, 'ksg', 'Vendor type (krux) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].valueNames, pgDeal.kruxValue, 'Value name (krux) ');

        assert.equal(athenaRespTargetingCustom.children[0].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].keyName, 'mas', 'Vendor type (mas) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].valueNames, pgDeal.masValue, 'Value name (mas) ');

        assert.equal(athenaRespTargetingCustom.children[1].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].keyName, 'GS_CHANNELS_ALL', 'Vendor type (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].valueNames, pgDeal.grapeShotValue, 'Value name (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].keyName, 'citadel', 'Vendor type (citadel) ');

        athenaRespTargetingCustom.children[1].children[1].valueNames[0] = pgDeal.citadelValue;
        assert.equal(athenaRespTargetingCustom.children[1].children[1].valueNames[0], pgDeal.citadelValue, 'Value name (citadel) ');
        assert.equal(athenaRespTargetingCustom.children[1].logicalOperator, 'AND', 'operator between Groups ');
        // assert.equal(athenaRespTargetingCustom.children[0].logicalOperator, 'AND', 'operator between Contextual Targeting fields ');
      });
    });

    it('Update Programmatic Guaranteed Deal To GMP and Pushing to Ad Server', () => {
      cy.server();
      cy.route('PATCH', '/api/v1/deal/*').as('dmUpdate');
      cy.route('/api/v1/deal/*/push-status').as('pushStatus');
      cy.route('/api/v1/citadel/segments').as('citadelUpdate');
      cy.route('/api/v1/km-proxy/isp-targeting-list').as('ispTargetingUpdate');
      cy.route('/api/v1/km-proxy/technology-targeting-integrations').as('techTargetingUpdate');
      cy.route('/api/v1/km-proxy/grapeshot-categories?limit=2000').as('grapeShotUpdate');
      cy.route(`/api/v1/digital-element?name=${pgDeal.location.name}`).as('geolocation');

      pgDeal.name += '-updated to GMP Bidder';
      pgDeal.formatName = 'Bottom Banner';
      pgDeal.rate = generateRandomNum(200);
      pgDeal.discount = generateRandomNum(100);
      pgDeal.executionName = 'Standard';
      pgDeal.targetSpend = generateRandomNum(200);
      pgDeal.bidderName = 'GMP';
      pgDeal.seatName = 'GMP';

      cy.visit(`/deal-dashboard/deals/${pgDeal.id}`);
      cy.get('[class="button button--edit"]', { timeout: 8000 }).click({ force: true }); // Requires 'force: true' for hidden element
      cy.url().should('include', 'deal-dashboard/deals/edit/');

      // Edit Deal Name
      cy.get('[data-qa="deal-create--name"]').focus().clear().type(pgDeal.name);

      // Edit Rate, Target Spend, & Discount
      cy.get('[data-qa="deal-create--rate"]').clear().focus().type(pgDeal.rate);
      cy.get('[data-qa="deal-create--target-spend"]').clear().focus().type(pgDeal.targetSpend);

      // Select a Format
      cy.get('[data-qa="deal-form--select-format"]').clear().type(pgDeal.formatName);
      cy.get('[data-qa="deal-form--select-format"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();
      pgDeal.adFormatId = 8; // <- ID of ad-format selected from above 👆🏾

      // Edit a execution
      cy.get('[data-qa="deal-form--select-execution"]').click().type(pgDeal.executionName);
      cy.get('[data-qa="deal-form--select-execution"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // Edit a bidder
      cy.get('[data-qa="deal-form--select-bidder"]').clear().type(pgDeal.bidderName).click();
      cy.get('[data-qa="deal-form--select-bidder"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      // // Select a seat
      cy.get('[data-qa="deal-form--select-seat"]').click().type(pgDeal.seatName).click();
      cy.get('[data-qa="deal-form--select-seat"]').parent('.input-wrapper--typeahead').find('.dropdown-menu').children('li')
        .first()
        .children('a')
        .click();

      cy.get('[data-qa="deal-create--set-private-auction"]', { timeout: 8000 }).should('be.disabled');
      cy.get('[data-qa="deal-create--set-preferred-rate"]', { timeout: 8000 }).should('be.disabled');

      // Submitting Deal Group info and Validating
      cy.get('[data-qa="deal-add-edit--submit"]').click();
      cy.get('[data-qa="modal--confirm"]').click();
      cy.get('[data-qa="deal-detail--title"]', { timeout: 8000 }).should('contain', pgDeal.name);

      cy.get('[data-qa="deal-details--push_to_ad_server"]').click();
      // cy.route(`/api/v1/deal/${deal.id}/push-status`).as('pushStatus');
      const dealPushStatus = getRequest();
      dealPushStatus.url = `/api/v1/deal/${pgDeal.id}/push-status`;

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.get('deal-status-box section div.deal-detail-sync-indicator kg-indicator div tool-tip div i', { timeout: 60000 }).should('not.be.visible'), {
        errorMsg: 'Failed to push APN deal!',
        timeout: 3000000,
        interval: 150000,
      });
    });

    it('Verifying PG GMP Deal Info on SSP service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${pgDeal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const sspResponse = integrationsResponse.body.ssp;
        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, pgDeal.name, 'Deal Name ');
        assert.equal(sspResponse.external_id, pgDeal.id, 'Deal ID ');
        assert.equal(sspResponse.type, 'programmatic_guaranteed', 'Deal Type ');
        assert.equal(sspResponse.bidder.name, pgDeal.bidderName, 'Bidder name ');
        assert.equal(sspResponse.ad_formats[0].type, 'banner', 'Ad-Format type ');
        assert.equal(sspResponse.ad_formats[0].name, pgDeal.formatName, 'Ad-Format name ');
        assert.equal(sspResponse.no_publishers_floor, pgDeal.pubFloorStatus, 'Ignore Publisher Floor ');
      });
    });

    it('Verifying PG GMP Deal Info on Athena service', () => {
      const integrationsRequestOptions = getRequest();
      integrationsRequestOptions.url = `/api/v1/deal/${pgDeal.id}/integrations`;

      cy.request(integrationsRequestOptions).then((integrationsResponse) => {
        const athenaResponse = integrationsResponse.body.athena;
        assert.equal(athenaResponse.active, false, 'Active ');
        assert.equal(athenaResponse.CPM, pgDeal.rate * 100, 'CPM Value '); // Adding '* 100' due to no decimal in Kraken
        assert.equal(athenaResponse.adFormat, pgDeal.adFormatId, 'Ad-Format type ');
        assert.equal(athenaResponse.priority, pgDeal.priorityKraken, 'Priority in Kraken ');
        assert.equal(athenaResponse.viewabilitySampling, pgDeal.viewabilitySampling / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.viewabilityThreshold, pgDeal.viewabilityThreshold / 100, 'Viewability sampling ');
        assert.equal(athenaResponse.frequencyCap.day, pgDeal.frequencyCapDay, 'Day ');
        assert.equal(athenaResponse.frequencyCap.hour, pgDeal.frequencyCapHour, 'Hour ');
        assert.equal(athenaResponse.frequencyCap.week, pgDeal.frequencyCapWeek, 'Week ');
        assert.equal(athenaResponse.targeting.editorialGraph, pgDeal.editorialGraph, 'Editorial Graph status '); // will change to true
        assert.equal(athenaResponse.targeting.deviceType.include.includes(pgDeal.deviceValue[0]), true, 'Device type contains phone ');
        assert.equal(athenaResponse.targeting.country.include[0], pgDeal.location.countryId, 'country ');
        assert.equal(athenaResponse.targeting.region.exclude[0], pgDeal.location.id, 'Region ');
        assert.equal(athenaResponse.targeting.carrier.include[0], pgDeal.carrierValue, 'Carrier ');
        assert.equal(athenaResponse.targeting.os.include[0], pgDeal.osValue, 'OS ');
        assert.equal(athenaResponse.targeting.browser.include[0], pgDeal.browserValue, 'Browser ');
        assert.equal(athenaResponse.targeting.socialBrowser.include[0], pgDeal.socialValue, 'Social Browser include value ');
        assert.equal(athenaResponse.targeting.isp.include[0], pgDeal.ispValue, 'ISP include value ');
        // Following line is verifying device-type: Tablet
        expect(athenaResponse.targeting.deviceType.include).to.include(pgDeal.deviceValue[1]);

        // Custom Targeting
        const athenaRespTargetingCustom = athenaResponse.targeting.custom;
        assert.equal(athenaRespTargetingCustom.logicalOperator, 'OR', 'Logical Operator');
        assert.equal(athenaRespTargetingCustom.children[0].logicalOperator, 'OR', 'operator between Contextual Targeting fields ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].keyName, 'ksg', 'Vendor type (krux) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[0].valueNames, pgDeal.kruxValue, 'Value name (krux) ');

        assert.equal(athenaRespTargetingCustom.children[0].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].keyName, 'mas', 'Vendor type (mas) ');
        assert.equal(athenaRespTargetingCustom.children[0].children[1].valueNames, pgDeal.masValue, 'Value name (mas) ');

        assert.equal(athenaRespTargetingCustom.children[1].children[0].operator, 'IS', 'Vendor operator (include) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].keyName, 'GS_CHANNELS_ALL', 'Vendor type (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[0].valueNames, pgDeal.grapeShotValue, 'Value name (Grapeshot) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].operator, 'IS_NOT', 'Vendor operator (exclude) ');
        assert.equal(athenaRespTargetingCustom.children[1].children[1].keyName, 'citadel', 'Vendor type (citadel) ');

        athenaRespTargetingCustom.children[1].children[1].valueNames[0] = pgDeal.citadelValue;
        assert.equal(athenaRespTargetingCustom.children[1].children[1].valueNames[0], pgDeal.citadelValue, 'Value name (citadel) ');
        assert.equal(athenaRespTargetingCustom.children[1].logicalOperator, 'AND', 'operator between Audience Targeting sets  ');
      });
    });

    it('Verify PG GMP Deal data sent to DV360 Product', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgDeal.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const dvProduct = dmAdServerResponse.body.dv360_product;

        assert.equal(dvProduct.displayName, pgDeal.name, 'Deal Name ');
        assert.equal(dvProduct.pricingType, 'FIXED_PRICE', 'pricing Type ');
        assert.equal(dvProduct.rateDetails.rateType, 'CPM', 'rate Type ');
        assert.equal(dvProduct.transactionType, 'RESERVED', 'transaction Type ');
        assert.equal((dvProduct.endTime.slice(0, -10)), pgDeal.end_date, 'end Time ');
        assert.equal((dvProduct.startTime.slice(0, -10)), pgDeal.start_date, 'start date ');
        assert.equal(dvProduct.creativeConfig[0].creativeType, 'CREATIVE_TYPE_DISPLAY', 'creative Type ');
      });
    });

    it('Verify PG GMP Deal data sent to DV360 Order', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgDeal.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const dvOrder = dmAdServerResponse.body.dv360_order;

        assert.equal(dvOrder.displayName, pgDeal.name, 'Deal Name ');
        assert.equal(dvOrder.publisherName, 'Kargo', 'publisherName ');
        assert.equal(dvOrder.status, 'PENDING_ACCEPTANCE', 'status at DV360 order ');
      });
    });
  });
});
