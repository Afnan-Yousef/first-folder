/* eslint-disable max-len */
import 'cypress-wait-until';

const { extend, isEqual } = require('lodash');
const nameHelper = require('../../helpers/name-helper');

context('Deals', () => {
  describe('Deals API Testing', () => {
    const getRequest = (options = {}) => {
      const defaultOptions = {
        auth: {
          bearer: Cypress.env('authToken'),
        },
      };
      return extend(defaultOptions, options);
    };

    const searchTerm = Cypress.moment().format('YY.MM.DD');
    const dmBidder = {};
    let bidderSspId;
    let dealGroupId;
    let dealPayload = {};
    let pgdealPayload = {};

    it('Prerequisite: Retrieve a Bidder', () => {
      const bidderSearchRequestOptns = getRequest({
        url: `/api/v1/bidder?limit=75&page=1&search=${searchTerm}`,
      });

      const createBidder = () => {
        let bidderPayload = {};

        cy.fixture('bidder.json').then((bidder) => {
          bidderPayload = extend(bidderPayload, bidder);
          bidderPayload.name = nameHelper.generateName('API-Bidder-Prerequisite');
          dmBidder.name = bidderPayload.name;
          bidderPayload.exchange_name = nameHelper.generateName('API-Exchange-Prerequisite');
        });

        const bidderCreationRequest = getRequest({
          method: 'POST',
          body: bidderPayload,
          url: '/api/v1/bidder',
        });

        const bidderPushRequest = getRequest({
          method: 'POST',
        });

        cy.request(bidderCreationRequest).then((bidderCreationResp) => {
          dmBidder.Id = bidderCreationResp.body.id;
          bidderPushRequest.url = `api/v1/bidder/${dmBidder.Id}/push-to-ad-server`;

          assert.equal(bidderCreationResp.status, 200, 'Successful response status value ');
          cy.task('log', 'Prerequisite Bidder created for Deal');
        });

        // Having a pushed Bidder is Required for Deal Creation
        cy.request(bidderPushRequest).then((bidderPushResp) => {
          assert.equal(bidderPushResp.status, 200, 'Response status value');
          cy.task('log', 'Prerequisite Bidder was pushed to Ad Server');
        });
      };

      cy.request(bidderSearchRequestOptns).then((bidderResponse) => {
        if (!bidderResponse.body.rows.length) {
          cy.task('log', 'No Bidders found');
          createBidder();
        } else {
          // eslint-disable-next-line camelcase
          const selectedBidder = bidderResponse.body.rows.find(({ is_synced }) => is_synced === true);
          if (!selectedBidder) {
            cy.task('log', 'Failed to find a Synced Bidder');
            createBidder();
          } else {
            dmBidder.Id = selectedBidder.id;
            dmBidder.name = selectedBidder.name;
          }
        }
      });
    });

    it('Prerequisite: Retrieve a Deal Group', () => {
      const dealGroupSearchRequestOptns = getRequest({
        url: `/api/v1/deal-group?limit=75&page=1&search=${searchTerm}&is_archived=false`,
      });

      const createDealGroup = () => {
        let dealGroupPayload = {};

        cy.fixture('deal-group.json').then((dealGroup) => {
          dealGroupPayload = extend(dealGroupPayload, dealGroup);
          dealGroupPayload.name = nameHelper.generateName('API-Deal-Group-Prerequisite');
          dealGroupPayload.salesforce_id = Cypress.moment().format('[api-]YYYYMMDDhhmmss');
          dealGroupPayload.dealGroupBuyer.bidder_id = dmBidder.Id;
        });

        const dealGroupCreationRequest = getRequest({
          method: 'POST',
          body: dealGroupPayload,
          url: '/api/v1/deal-group',
        });

        cy.request(dealGroupCreationRequest).then((dealGroupCreationResp) => {
          dealGroupId = dealGroupCreationResp.body.id;
          assert.equal(dealGroupCreationResp.status, 200, 'Successful response status value ');
          cy.task('log', 'Prerequisite Deal-Group created for Deal');
        });
      };

      cy.request(dealGroupSearchRequestOptns).then((dealGroupResp) => {
        if (!dealGroupResp.body.rows.length) {
          cy.task('log', 'No Deal-Group found');
          createDealGroup();
        } else {
          // eslint-disable-next-line camelcase
          const selectedDealGroup = dealGroupResp.body.rows.find(({ closed_loop_report }) => closed_loop_report === 'closed_loop');
          // Looking for 'closed_loop' to retrieve a automated API Deal-Group instead of UI one
          if (!selectedDealGroup) {
            cy.task('log', 'Failed to find a API Deal Group');
            createDealGroup();
          } else {
            dealGroupId = selectedDealGroup.id;
          }
        }
      });
    });

    it('Create a Private Bottom-Banner Deal ', () => {
      cy.fixture('deal.json').then((deal) => {
        dealPayload = extend(dealPayload, deal);
        dealPayload.name = nameHelper.generateName('API-Deal-Private-Bottom');
        dealPayload.deal_group_id = dealGroupId;
        dealPayload.dealBuyer.bidder_id = dmBidder.Id;
        dealPayload.start_date = Cypress.moment().format('YYYY-MM-DD');
        dealPayload.end_date = Cypress.moment(dealPayload.end_date).add(4, 'months').format('YYYY-MM-DD');
      });

      const dealCreationRequest = getRequest({
        method: 'POST',
        body: dealPayload,
        url: '/api/v1/deal',
      });

      cy.request(dealCreationRequest).then((dealResponse) => {
        dealPayload.id = dealResponse.body.id;
        dealPayload.status = dealResponse.body.status;
        dealPayload.deal_id = dealResponse.body.deal_id;
        assert.equal(dealResponse.status, 200, 'Successful response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'Deal response id is greater than 0 ');
      });
    });

    it('Push Private Bottom-Banner Deal to Ad Server', () => {
      const pushDealRequest = getRequest({
        method: 'POST',
        body: dealPayload,
        url: `/api/v1/deal/${dealPayload.id}/sync`,
      });

      const dealPushStatus = getRequest();
      dealPushStatus.url = `/api/v1/deal/${dealPayload.id}/push-status`;

      cy.request(pushDealRequest).then((pushDealResponse) => {
        dealPayload.status = 'ACTIVE';
        assert.equal(pushDealResponse.status, 200, 'Successful response status value ');
      });

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.request(dealPushStatus).then(pushResponse => pushResponse.body.completed === true), { verbose: true, errorMsg: 'Deal did not push successfully' });
      cy.request(dealPushStatus).then((pushResponse) => {
        if (pushResponse.body.log[0].output) {
          throw new Error(pushResponse.body.log[0].output.message);
        }
      });
    });

    it('Verify Created Private Bottom-Banner Deal on DM', () => {
      const dealRequest = getRequest({
        url: `/api/v1/deal/${dealPayload.id}?with=dealBuyer,dealAdvertiser`,
      });

      cy.request(dealRequest).then((deal) => {
        const dealResponse = deal.body;
        // const dealRespTargeting = deal.body.targeting;
        // const dealTargeting = dealPayload.targeting;

        assert.equal(deal.status, 200, 'Successful response status value ');

        // Deal details validations
        assert.equal(dealResponse.name, dealPayload.name, 'Deal Name ');
        assert.equal(dealResponse.type, dealPayload.type.toUpperCase(), 'Deal type ');
        assert.equal(dealResponse.price, dealPayload.price, 'Rate ');
        assert.equal(dealResponse.target_spend, dealPayload.target_spend, 'Target Spend ');
        assert.equal(dealResponse.price_discount_percentage, dealPayload.price_discount_percentage, 'Discount Rate ');

        assert.equal(dealResponse.km_execution_id, dealPayload.km_execution_id, 'Execution ID ');
        assert.equal(dealResponse.km_format_id, dealPayload.km_format_id, 'Format ID ');
        assert.equal(dealResponse.start_date, dealPayload.start_date, 'Start Date ');
        assert.equal(dealResponse.end_date, dealPayload.end_date, 'End Date ');
        assert.equal(dealResponse.status, dealPayload.status, 'Status type ');

        assert.equal(dealResponse.site_list_id, dealPayload.site_list_id, 'Site-list Id ');
        assert.equal(dealResponse.site_list_type, dealPayload.site_list_type, 'Site-list type ');
        assert.equal(dealResponse.dealBuyer.bidder_id, dealPayload.dealBuyer.bidder_id, 'Bidder Id ');
        assert.equal(dealResponse.dealAdvertiser[0].km_advertiser_id, dealPayload.advertisers[0], 'Advertiser ID ');
        assert.equal(dealResponse.prioritize_inventory_targeting, dealPayload.prioritize_inventory_targeting, 'Prioritizing Inventory aka Editorial-Graph ');
        cy.task('log', 'Deal Info Matched');
      });
    });

    it('Verify Private Bottom-Banner Deal data sent to SSP', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${dealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const sspResponse = dmAdServerResponse.body.ssp;
        bidderSspId = sspResponse.bidder.id;
        cy.log(bidderSspId);

        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, dealPayload.name, 'Deal Name ');
        assert.equal(sspResponse.bidder.name, dmBidder.name, 'Bidder Id ');
        assert.equal(sspResponse.external_id, dealPayload.id, 'Deal ID ');
        assert.equal(sspResponse.bid_floor, dealPayload.price, 'Bid Floor ');
        assert.equal(sspResponse.deal_id, dealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(sspResponse.type, 'private_auction', 'Deal Type ');
        assert.equal(sspResponse.start_date, dealPayload.start_date, 'Deal Start Date ');
        assert.equal(sspResponse.ad_formats[0].id, dealPayload.km_format_id, 'Ad-Format ID ');
      });
    });

    it('Verify Private Bottom-Banner Deal data sent to Athena', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${dealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const krakenResponse = dmAdServerResponse.body.athena_deal;

        assert.equal(dmAdServerResponse.status, 200, 'Successful response status value ');

        // Deal detailed info validations on Kraken
        assert.equal(krakenResponse.active, true, 'Active value '); // Testing against true since deal expected to be active
        assert.equal(krakenResponse.priority, 6, 'Priority value '); // Expected is 6 for the default value
        assert.equal(krakenResponse.pacingType, 'evenly', 'pacingType value '); // Expected is 'evenly' for the default value
        assert.equal(krakenResponse.CPM, dealPayload.price * 100, 'CPM value ');
        assert.equal(krakenResponse.bidder, bidderSspId, 'Bidder ID ');
        assert.equal(krakenResponse.dealID, dealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(krakenResponse.startDate.includes(dealPayload.start_date), true, 'Start Date value ');
        assert.equal(krakenResponse.endDate.includes(dealPayload.end_date.slice(0, -2)), true, 'End Date value '); // taking off day since kraken uses UTC
      });
    });

    it('Edit Deal To APN Preferred Fixed Rate Deal', () => {
      dealPayload.name += '_updated-to_APN-PFR-Deal';
      dealPayload.original_price = nameHelper.generateRandomNum(1000);
      dealPayload.target_spend = nameHelper.generateRandomNum(10000);
      dealPayload.price_discount_percentage = nameHelper.generateRandomNum(100) / 100;
      dealPayload.start_date = Cypress.moment().format('YYYY-MM-DD');
      dealPayload.end_date = Cypress.moment(dealPayload.end_date).add(4, 'months').format('YYYY-MM-DD');
      dealPayload.dealBuyer.bidder_id = 90108;
      dealPayload.dealBuyer.seat_id = 83979;
      dealPayload.type = 'Preferred_Fixed_Rate';

      const dealUpdateRequest = getRequest({
        method: 'PATCH',
        body: dealPayload,
        url: `/api/v1/deal/${dealPayload.id}`,
      });

      cy.request(dealUpdateRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Successful response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'Deal response id is greater than 0 ');
      });
    });

    it('Adding Targeting to APN Preferred Fixed Deal, Also Repush the Deal ', () => {
      cy.fixture('deal-targeting.json').then((deal) => {
        dealPayload = extend(dealPayload, deal);
      });

      const dealUpdateRequest = getRequest({
        method: 'PATCH',
        body: dealPayload,
        url: `/api/v1/deal/${dealPayload.id}`,
      });

      cy.request(dealUpdateRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Successful response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'Deal response id is greater than 0 ');
      });

      const pushDealRequest = getRequest({
        method: 'POST',
        body: dealPayload,
        url: `/api/v1/deal/${dealPayload.id}/sync`,
      });

      const dealPushStatus = getRequest();
      dealPushStatus.url = `/api/v1/deal/${dealPayload.id}/push-status`;

      cy.request(pushDealRequest).then((pushDealResponse) => {
        dealPayload.status = 'ACTIVE';
        assert.equal(pushDealResponse.status, 200, 'Successful response status value ');
      });

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.request(dealPushStatus).then(pushResponse => pushResponse.body.completed === true), { verbose: true, errorMsg: 'Deal did not push successfully' });
      cy.request(dealPushStatus).then((pushResponse) => {
        if (pushResponse.body.log[0].output) {
          throw new Error(pushResponse.body.log[0].output.message);
        }
      });
    });

    it('Verify Edited APN Preferred Fixed Rate Deal on DM', () => {
      const dealRequest = getRequest({
        url: `/api/v1/deal/${dealPayload.id}?with=dealBuyer,dealAdvertiser`,
      });

      cy.request(dealRequest).then((deal) => {
        const dealResponse = deal.body;
        const dealRespTargeting = deal.body.targeting;
        const dealTargeting = dealPayload.targeting;

        assert.equal(deal.status, 200, 'Successful response status value ');

        // Deal details validations
        assert.equal(dealResponse.name, dealPayload.name, 'Deal Name ');
        assert.equal(dealResponse.type, dealPayload.type.toUpperCase(), 'Deal type ');
        assert.equal(dealResponse.price, dealPayload.price, 'Rate ');
        assert.equal(dealResponse.target_spend, dealPayload.target_spend, 'Target Spend ');
        assert.equal(dealResponse.price_discount_percentage, dealPayload.price_discount_percentage, 'Discount Rate ');

        assert.equal(dealResponse.km_execution_id, dealPayload.km_execution_id, 'Execution ID ');
        assert.equal(dealResponse.km_format_id, dealPayload.km_format_id, 'Format ID ');
        assert.equal(dealResponse.start_date, dealPayload.start_date, 'Start Date ');
        assert.equal(dealResponse.end_date, dealPayload.end_date, 'End Date ');
        assert.equal(dealResponse.status, dealPayload.status, 'Status type ');

        assert.equal(dealResponse.site_list_id, dealPayload.site_list_id, 'Site-list Id ');
        assert.equal(dealResponse.site_list_type, dealPayload.site_list_type, 'Site-list type ');
        assert.equal(dealResponse.dealBuyer.bidder_id, dealPayload.dealBuyer.bidder_id, 'Bidder Id ');
        assert.equal(dealResponse.dealAdvertiser[0].km_advertiser_id, dealPayload.advertisers[0], 'Advertiser ID ');
        assert.equal(dealResponse.prioritize_inventory_targeting, dealPayload.prioritize_inventory_targeting, 'Prioritizing Inventory aka Editorial-Graph ');
        cy.task('log', 'Deal Info Matched');

        assert.equal(dealRespTargeting.optimizations.frequency_cap.day, dealTargeting.optimizations.frequency_cap.day, 'Frequency Cap Day ');
        assert.equal(dealRespTargeting.optimizations.frequency_cap.hour, dealTargeting.optimizations.frequency_cap.hour, 'Frequency Cap Hour ');
        assert.equal(dealRespTargeting.optimizations.frequency_cap.week, dealTargeting.optimizations.frequency_cap.week, 'Frequency Cap Week ');
        assert.equal(dealRespTargeting.optimizations.status_viewability, dealTargeting.optimizations.status_viewability, 'Viewability Status ');
        assert.equal(dealRespTargeting.optimizations.threshold_viewability, dealTargeting.optimizations.threshold_viewability, 'Viewability Threshold ');
        assert.equal(dealRespTargeting.optimizations.sample_rate_viewability, dealTargeting.optimizations.sample_rate_viewability, 'Viewability Sample Rate ');
        assert.equal(dealRespTargeting.os_targeting.included[0].name, dealTargeting.os_targeting.included[0].name, 'OS Targeting Name ');
        assert.equal(dealRespTargeting.os_targeting.included[0].value, dealTargeting.os_targeting.included[0].value, 'OS Targeting Type ');
        assert.equal(dealRespTargeting.browser_targeting.included[0].name, dealTargeting.browser_targeting.included[0].name, 'Browser Name ');
        assert.equal(dealRespTargeting.browser_targeting.included[0].value, dealTargeting.browser_targeting.included[0].value, 'Browser Type ');
        assert.equal(dealRespTargeting.device_targeting.included[0].name, dealTargeting.device_targeting.included[0].name, 'Device Name ');
        assert.equal(dealRespTargeting.device_targeting.included[0].value, dealTargeting.device_targeting.included[0].value, 'Device type ');
        assert.equal(dealRespTargeting.device_targeting.included[1].name, dealTargeting.device_targeting.included[1].name, '2nd Device Name ');
        assert.equal(dealRespTargeting.device_targeting.included[1].value, dealTargeting.device_targeting.included[1].value, '2nd Device Type ');
        assert.equal(isEqual(dealRespTargeting.geo_targeting.included, dealTargeting.geo_targeting.included), true, 'GeoTargeting Includes matches ');
        assert.equal(isEqual(dealRespTargeting.geo_targeting.excluded, dealTargeting.geo_targeting.excluded), true, 'GeoTargeting Excluded matches ');
        assert.equal(isEqual(dealRespTargeting.isp_targeting.included, dealTargeting.isp_targeting.included), true, 'ISP Targeting Included matches ');
        assert.equal(dealRespTargeting.custom_targeting[0].logicalOperator, dealTargeting.custom_targeting[0].logicalOperator, 'Logical Operator ');
        assert.equal(isEqual(dealRespTargeting.custom_targeting[0].children[0], dealTargeting.custom_targeting[0].children[0]), true, 'Citadel/Grapeshot object matches ');
        assert.equal(isEqual(dealRespTargeting.custom_targeting[1].children[1], dealTargeting.custom_targeting[1].children[1]), true, 'Krux/Mas object matches ');
        cy.task('log', 'Deal Targeting Matched');
      });
    });

    it('Verify APN Preferred Fixed Rate Deal data sent to SSP', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${dealPayload.id}/integrations`;
      dmBidder.name = 'APN';

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const sspResponse = dmAdServerResponse.body.ssp;
        bidderSspId = sspResponse.bidder.id;
        cy.log(bidderSspId);

        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, dealPayload.name, 'Deal Name ');
        assert.equal(sspResponse.bidder.name, dmBidder.name, 'Bidder Id ');
        assert.equal(sspResponse.external_id, dealPayload.id, 'Deal ID ');
        // assert.equal(sspResponse.bid_floor, dealPayload.price, 'Bid Floor ');
        assert.equal(sspResponse.deal_id, dealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(sspResponse.type, 'preferred_fixed_price', 'Deal Type ');
        assert.equal(sspResponse.start_date, dealPayload.start_date, 'Deal Start Date ');
        assert.equal(sspResponse.ad_formats[0].id, dealPayload.km_format_id, 'Ad-Format ID ');
      });
    });

    it('Verify APN Preferred Fixed Rate Deal data sent to Athena', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${dealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const krakenResponse = dmAdServerResponse.body.athena_deal;
        const krakenTargeting = krakenResponse.targeting;
        const dealTargeting = dealPayload.targeting;

        assert.equal(dmAdServerResponse.status, 200, 'Successful response status value ');

        // Deal detailed info validations on Kraken
        assert.equal(krakenResponse.active, true, 'Active value '); // Testing against true since deal expected to be active
        assert.equal(krakenResponse.priority, 6, 'Priority value '); // Expected is 6 for the default value
        assert.equal(krakenResponse.pacingType, 'evenly', 'pacingType value '); // Expected is 'evenly' for the default value
        assert.equal(krakenResponse.CPM, dealPayload.price * 100, 'CPM value ');
        assert.equal(krakenResponse.bidder, bidderSspId, 'Bidder ID ');
        assert.equal(krakenResponse.dealID, dealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(krakenResponse.startDate.includes(dealPayload.start_date), true, 'Start Date value ');
        assert.equal(krakenResponse.endDate.includes(dealPayload.end_date.slice(0, -2)), true, 'End Date value '); // taking off day since kraken uses UTC
        assert.equal(krakenResponse.frequencyCap.day, dealTargeting.optimizations.frequency_cap.day, 'Frequency Cap Day ');
        assert.equal(krakenResponse.frequencyCap.hour, dealTargeting.optimizations.frequency_cap.hour, 'Frequency Cap Hour ');
        assert.equal(krakenResponse.frequencyCap.week, dealTargeting.optimizations.frequency_cap.week, 'Frequency Cap Week ');
        assert.equal(krakenResponse.viewabilitySampling, dealTargeting.optimizations.sample_rate_viewability, 'Viewability Sample Rate ');
        assert.equal(krakenResponse.viewabilityThreshold, dealTargeting.optimizations.threshold_viewability, 'Viewability Threshold ');

        // Targeting Verification
        assert.isAbove(krakenTargeting.adSlots.length, 0, 'Has at least 1 ad-slot '); // This is expect since site-list is being pushed
        assert.equal(krakenTargeting.os.include[0], dealTargeting.os_targeting.included[0].value, 'OS Targeting Type ');
        assert.equal(krakenTargeting.runOfNetwork, !dealPayload.site_list_type, 'Run Of Network status ');
        assert.equal(krakenTargeting.editorialGraph, dealPayload.prioritize_inventory_targeting, 'Editorial-Graph status ');
        assert.equal(krakenTargeting.browser.include[0], dealTargeting.browser_targeting.included[0].value, 'Browser Type ');
        assert.equal(krakenTargeting.socialBrowser.include[0], dealTargeting.social_targeting.included[0].value, 'Social-Browser Type values ');
        assert.equal(isEqual(krakenTargeting.isp.include[0], dealTargeting.isp_targeting.included[0].name), true, 'ISP Targeting Included matches ');
        assert.equal(krakenTargeting.deviceType.include.includes(dealTargeting.device_targeting.included[0].value), true, '1st Device Type found in Response');
        assert.equal(krakenTargeting.deviceType.include.includes(dealTargeting.device_targeting.included[1].value), true, '2nd Device Type found in Response ');
        assert.equal(krakenTargeting.adSlotTargetingType.includes(dealPayload.site_list_type.toLowerCase().slice(0, -4)), true, 'Site-list status matches ');

        assert.equal(krakenTargeting.custom.logicalOperator, dealTargeting.custom_targeting[0].logicalOperator, 'Logical Operator ');
        assert.equal(krakenTargeting.custom.children[0].children[0].keyName, dealTargeting.custom_targeting[0].children[0].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[0].children[0].valueNames[0], dealTargeting.custom_targeting[0].children[0].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[0].children[0].operator, 'IS', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[0].children[1].keyName, dealTargeting.custom_targeting[0].children[1].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[0].children[1].valueNames[0], dealTargeting.custom_targeting[0].children[1].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[0].children[1].operator, 'IS_NOT', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[1].children[0].keyName, dealTargeting.custom_targeting[1].children[0].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[1].children[0].valueNames[0], dealTargeting.custom_targeting[1].children[0].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[1].children[0].operator, 'IS', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[1].children[1].keyName, dealTargeting.custom_targeting[1].children[1].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[1].children[1].valueNames[0], dealTargeting.custom_targeting[1].children[1].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[1].children[1].operator, 'IS_NOT', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[1].logicalOperator, dealTargeting.custom_targeting[1].logicalOperator, 'Logical Operator between the groups ');

        // custom logic needed for geo-targeting verification
        // logic need for discount cpm verification

        // equal(krakenResponse.adFormat, 8,); // will figure out later why ad-format is 8; need ad-format call, 8 is in-hub id
      });
    });

    it('Verify APN Preferred Fixed Rate Deal data sent to App-Nexus', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${dealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const appNexus = dmAdServerResponse.body.app_nexus_deal;

        assert.equal(appNexus.name, dealPayload.name, 'Deal Name ');
        assert.equal(appNexus.code, dealPayload.deal_id, 'Kargo Deal ID ');
        assert.equal(appNexus.active, true, 'deal status ');
        assert.equal(appNexus.type.name, 'Private Auction', 'rate Type ');
        assert.equal(appNexus.auction_type.name, 'Fixed Price', 'rate Type ');
        assert.equal(appNexus.use_deal_floor, true, 'Use Deal Floor ');
        assert.equal(appNexus.priority, 5, 'Priority ');
        assert.equal(appNexus.currency, 'USD', 'Currency Type ');
        assert.equal((appNexus.end_date.slice(0, -9)), dealPayload.end_date, 'end Time ');
        assert.equal((appNexus.start_date.slice(0, -9)), dealPayload.start_date, 'start date ');
        assert.equal(appNexus.floor_price, dealPayload.price, 'Floor price');
        assert.equal(appNexus.ask_price, dealPayload.price, 'Ask price');
        assert.equal(appNexus.created_by, 'seller', 'Created by ');
        assert.equal(appNexus.seller.id, 8173, 'Seller ID ');
        assert.equal(appNexus.seller.name, 'Kargo Global, Inc', 'Seller Name ');
        assert.equal(appNexus.seller.bidder_id, 2, 'Bidder ID on AppNexus ');
        assert.equal(appNexus.buyer.id, 882, 'Buyer ID ');
        assert.equal(appNexus.buyer.bidder_supports_hashed_user_ids, false, 'Bidder supports IDs ');
        assert.equal(appNexus.buyer.guaranteed_deals_support, 'Disabled', 'guaranteed deals support ');
        assert.equal(appNexus.buyer.name, 'AN Talent', 'Buyer name ');
        assert.equal(appNexus.buyer.bidder_name, 'DisplayWordsAuto', 'Bidder name ');
        assert.equal(appNexus.buyer_exposure.id, 1, 'Buyer exposure ID ');
        assert.equal(appNexus.buyer_exposure.name, 'Single buyer', 'Buyer exposure name ');
        assert.equal(appNexus.size_preference, 'standard', 'Size preference ');
        assert.equal(appNexus.category_restrict, true, 'Category restrict ');
        assert.equal(appNexus.technical_attribute_restrict, true, 'Technical attribute restrict ');
        assert.equal(appNexus.language_restrict, true, 'Language restrict ');
        assert.equal(appNexus.use_deal_floor, true, 'Use deal floor ');
        assert.equal(appNexus.allow_creative_add_on_click, true, 'Allow creative add on click ');
      });
    });

    it('Archive APN Preferred Fixed Rate Deal', () => {
      const dealArchiveRequest = getRequest({
        method: 'DELETE',
        url: `/api/v1/deal/${dealPayload.id}`,
      });

      cy.request(dealArchiveRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Response status value ');
        assert.equal(dealResponse.body, 'Model deleted', 'Deal status : ');
      });
    });

    it('Unarchive APN Preferred Fixed Rate Deal', () => {
      const dealUnarchiveRequest = getRequest({
        method: 'PUT',
        url: `/api/v1/deal/${dealPayload.id}/unarchive`,
      });

      cy.request(dealUnarchiveRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'id is greater than 0 ');
      });
    });

    it('Create a GMP Programmatic Guaranteed Deal ', () => {
      cy.fixture('pgdeal.json').then((pgdeal) => {
        pgdealPayload = extend(pgdealPayload, pgdeal);
        pgdealPayload.name = nameHelper.generateName('API-Deal-PG-Bottom');
        pgdealPayload.deal_group_id = dealGroupId;
        pgdealPayload.price = nameHelper.generateRandomNum(100);
        pgdealPayload.buffered_goal = nameHelper.generateRandomNum(100);
        pgdealPayload.buffer_percentage = nameHelper.generateRandomNum(10);
        pgdealPayload.target_spend = nameHelper.generateRandomNum(1000);
        pgdealPayload.start_date = Cypress.moment().format('YYYY-MM-DD');
        pgdealPayload.end_date = Cypress.moment(dealPayload.end_date).add(4, 'months').format('YYYY-MM-DD');
        pgdealPayload.dealBuyer.bidder_id = 90107;
        pgdealPayload.dealBuyer.seat_id = 83978;
      });

      const dealCreationRequest = getRequest({
        method: 'POST',
        body: pgdealPayload,
        url: '/api/v1/deal',
      });

      cy.request(dealCreationRequest).then((dealResponse) => {
        pgdealPayload.id = dealResponse.body.id;
        pgdealPayload.status = dealResponse.body.status;
        pgdealPayload.deal_id = dealResponse.body.deal_id;
        cy.log(pgdealPayload);
        assert.equal(dealResponse.status, 200, 'Successful response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'Deal response id is greater than 0 ');
      });
    });

    it('Push GMP Programmatic Guaranteed Deal to Ad Server', () => {
      const pushDealRequest = getRequest({
        method: 'POST',
        body: pgdealPayload,
        url: `/api/v1/deal/${pgdealPayload.id}/sync`,
      });

      const dealPushStatus = getRequest();
      dealPushStatus.url = `/api/v1/deal/${pgdealPayload.id}/push-status`;

      cy.request(pushDealRequest).then((pushDealResponse) => {
        pgdealPayload.status = 'INACTIVE';
        assert.equal(pushDealResponse.status, 200, 'Successful response status value ');
      });

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.request(dealPushStatus).then(pushResponse => pushResponse.body.completed === true), { verbose: true, errorMsg: 'Deal did not push successfully' });
      cy.request(dealPushStatus).then((pushResponse) => {
        if (pushResponse.body.log[0].output) {
          throw new Error(pushResponse.body.log[0].output.message);
        }
      });
    });

    it('Verify Created GMP Programmatic Guaranteed Deal on DM', () => {
      const dealRequest = getRequest({
        url: `/api/v1/deal/${pgdealPayload.id}?with=dealBuyer,dealAdvertiser`,
      });

      cy.request(dealRequest).then((deal) => {
        const dealResponse = deal.body;
        // const dealRespTargeting = deal.body.targeting;
        // const dealTargeting = pgdealPayload.targeting;

        assert.equal(deal.status, 200, 'Successful response status value ');

        // Deal details validations
        assert.equal(dealResponse.name, pgdealPayload.name, 'Deal Name ');
        assert.equal(dealResponse.type, pgdealPayload.type.toUpperCase(), 'Deal type ');
        assert.equal(dealResponse.price, pgdealPayload.price, 'Rate ');
        assert.equal(dealResponse.target_spend, pgdealPayload.target_spend, 'Target Spend ');
        assert.equal(dealResponse.price_discount_percentage, pgdealPayload.price_discount_percentage, 'Discount Rate ');

        assert.equal(dealResponse.km_execution_id, pgdealPayload.km_execution_id, 'Execution ID ');
        assert.equal(dealResponse.km_format_id, pgdealPayload.km_format_id, 'Format ID ');
        assert.equal(dealResponse.start_date, pgdealPayload.start_date, 'Start Date ');
        assert.equal(dealResponse.end_date, pgdealPayload.end_date, 'End Date ');
        assert.equal(dealResponse.status, pgdealPayload.status, 'Status type ');

        // assert.equal(dealResponse.site_list_id, pgdealPayload.site_list_id, 'Site-list Id ');
        // assert.equal(dealResponse.site_list_type, pgdealPayload.site_list_type, 'Site-list type ');
        // assert.equal(dealResponse.dealBuyer.bidder_id, pgdealPayload.dealBuyer.bidder_id, 'Bidder Id ');
        // assert.equal(dealResponse.dealAdvertiser[0].km_advertiser_id, pgdealPayload.advertisers[0], 'Advertiser ID ');
        // assert.equal(dealResponse.prioritize_inventory_targeting, pgdealPayload.prioritize_inventory_targeting, 'Prioritizing Inventory aka Editorial-Graph ');
        // cy.task('log', 'Deal Info Matched');

        // assert.equal(dealRespTargeting.optimizations.frequency_cap.day, dealTargeting.optimizations.frequency_cap.day, 'Frequency Cap Day ');
        // assert.equal(dealRespTargeting.optimizations.frequency_cap.hour, dealTargeting.optimizations.frequency_cap.hour, 'Frequency Cap Hour ');
        // assert.equal(dealRespTargeting.optimizations.frequency_cap.week, dealTargeting.optimizations.frequency_cap.week, 'Frequency Cap Week ');
        // assert.equal(dealRespTargeting.optimizations.status_viewability, dealTargeting.optimizations.status_viewability, 'Viewability Status ');
        // assert.equal(dealRespTargeting.optimizations.threshold_viewability, dealTargeting.optimizations.threshold_viewability, 'Viewability Threshold ');
        // assert.equal(dealRespTargeting.optimizations.sample_rate_viewability, dealTargeting.optimizations.sample_rate_viewability, 'Viewability Sample Rate ');
        // assert.equal(dealRespTargeting.os_targeting.included[0].name, dealTargeting.os_targeting.included[0].name, 'OS Targeting Name ');
        // assert.equal(dealRespTargeting.os_targeting.included[0].value, dealTargeting.os_targeting.included[0].value, 'OS Targeting Type ');
        // assert.equal(dealRespTargeting.browser_targeting.included[0].name, dealTargeting.browser_targeting.included[0].name, 'Browser Name ');
        // assert.equal(dealRespTargeting.browser_targeting.included[0].value, dealTargeting.browser_targeting.included[0].value, 'Browser Type ');
        // assert.equal(dealRespTargeting.device_targeting.included[0].name, dealTargeting.device_targeting.included[0].name, 'Device Name ');
        // assert.equal(dealRespTargeting.device_targeting.included[0].value, dealTargeting.device_targeting.included[0].value, 'Device type ');
        // assert.equal(dealRespTargeting.device_targeting.included[1].name, dealTargeting.device_targeting.included[1].name, '2nd Device Name ');
        // assert.equal(dealRespTargeting.device_targeting.included[1].value, dealTargeting.device_targeting.included[1].value, '2nd Device Type ');
        // assert.equal(isEqual(dealRespTargeting.geo_targeting.included, dealTargeting.geo_targeting.included), true, 'GeoTargeting Includes matches ');
        // assert.equal(isEqual(dealRespTargeting.geo_targeting.excluded, dealTargeting.geo_targeting.excluded), true, 'GeoTargeting Excluded matches ');
        // assert.equal(isEqual(dealRespTargeting.isp_targeting.included, dealTargeting.isp_targeting.included), true, 'ISP Targeting Included matches ');
        // assert.equal(dealRespTargeting.custom_targeting[0].logicalOperator, dealTargeting.custom_targeting[0].logicalOperator, 'Logical Operator ');
        // assert.equal(isEqual(dealRespTargeting.custom_targeting[0].children[0], dealTargeting.custom_targeting[0].children[0]), true, 'Citadel/Grapeshot object matches ');
        // assert.equal(isEqual(dealRespTargeting.custom_targeting[0].children[1], dealTargeting.custom_targeting[0].children[1]), true, 'Krux/Mas object matches ');
        // cy.task('log', 'Deal Targeting Matched');
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to SSP', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;
      dmBidder.name = 'GMP';

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const sspResponse = dmAdServerResponse.body.ssp;
        bidderSspId = sspResponse.bidder.id;
        cy.log(bidderSspId);

        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, pgdealPayload.name, 'Deal Name ');
        assert.equal(sspResponse.bidder.name, dmBidder.name, 'Bidder Id ');
        assert.equal(sspResponse.external_id, pgdealPayload.id, 'Deal ID ');
        assert.equal(sspResponse.deal_id, pgdealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(sspResponse.type, 'programmatic_guaranteed', 'Deal Type ');
        assert.equal(sspResponse.start_date, pgdealPayload.start_date, 'Deal Start Date ');
        assert.equal(sspResponse.ad_formats[0].id, pgdealPayload.km_format_id, 'Ad-Format ID ');
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to Athena', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const krakenResponse = dmAdServerResponse.body.athena_deal;
        // const krakenTargeting = krakenResponse.targeting;
        // const dealTargeting = pgdealPayload.targeting;

        assert.equal(dmAdServerResponse.status, 200, 'Successful response status value ');

        // Deal detailed info validations on Kraken
        assert.equal(krakenResponse.active, false, 'Active value '); // Testing against true since deal expected to be active
        assert.equal(krakenResponse.priority, 6, 'Priority value '); // Expected is 6 for the default value
        assert.equal(krakenResponse.pacingType, 'evenly', 'pacingType value '); // Expected is 'evenly' for the default value
        assert.equal(krakenResponse.CPM, pgdealPayload.price * 100, 'CPM value ');
        assert.equal(krakenResponse.bidder, bidderSspId, 'Bidder ID ');
        assert.equal(krakenResponse.dealID, pgdealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(krakenResponse.startDate.includes(pgdealPayload.start_date), true, 'Start Date value ');
        assert.equal(krakenResponse.endDate.includes(pgdealPayload.end_date.slice(0, -2)), true, 'End Date value '); // taking off day since kraken uses UTC
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to DV360 Product', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const dvProduct = dmAdServerResponse.body.dv360_product;
        // We verify static data since the data in this service is not existed in DM site

        assert.equal(dvProduct.displayName, pgdealPayload.name, 'Deal Name ');
        assert.equal(dvProduct.pricingType, 'FIXED_PRICE', 'pricing Type ');
        assert.equal(dvProduct.rateDetails.rateType, 'CPM', 'rate Type ');
        assert.equal(dvProduct.transactionType, 'RESERVED', 'transaction Type ');
        assert.equal((dvProduct.endTime.slice(0, -10)), pgdealPayload.end_date, 'end Time ');
        assert.equal((dvProduct.startTime.slice(0, -10)), pgdealPayload.start_date, 'start date ');
        assert.equal(dvProduct.creativeConfig[0].creativeType, 'CREATIVE_TYPE_DISPLAY', 'creative Type ');
        assert.equal(dvProduct.externalDealId, pgdealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(dvProduct.rateDetails.rateType, 'CPM', 'Rate Type ');
        assert.equal(dvProduct.rateDetails.rate.currencyCode, 'USD', 'Rate Type ');
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to DV360 Order', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const dvOrder = dmAdServerResponse.body.dv360_order;

        assert.equal(dvOrder.displayName, pgdealPayload.name, 'Deal Name ');
        assert.equal(dvOrder.publisherName, 'Kargo', 'publisherName ');
        assert.equal(dvOrder.status, 'PENDING_ACCEPTANCE', 'status at DV360 order ');
        assert.equal(dvOrder.partnerId[0], '10005', 'Partner ID ');
      });
    });

    it('Adding Targeting to Created GMP Programmatic Guaranteed Deal', () => {
      cy.fixture('deal-targeting.json').then((deal) => {
        pgdealPayload = extend(pgdealPayload, deal);
      });

      const dealUpdateRequest = getRequest({
        method: 'PATCH',
        body: pgdealPayload,
        url: `/api/v1/deal/${pgdealPayload.id}`,
      });
      cy.request(dealUpdateRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Successful response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'Deal response id is greater than 0 ');
      });
    });

    it('Repush GMP Programmatic Guaranteed Deal to Ad Server', () => {
      const pushDealRequest = getRequest({
        method: 'POST',
        body: pgdealPayload,
        url: `/api/v1/deal/${pgdealPayload.id}/sync`,
      });

      const dealPushStatus = getRequest();
      dealPushStatus.url = `/api/v1/deal/${pgdealPayload.id}/push-status`;

      cy.request(pushDealRequest).then((pushDealResponse) => {
        pgdealPayload.status = 'INACTIVE';
        assert.equal(pushDealResponse.status, 200, 'Successful response status value ');
      });

      // Following cy.waitUntil function retries a function until it yields a truthy value
      // This was needed to check the push-status API call until it yields: push was completed
      cy.waitUntil(() => cy.request(dealPushStatus).then(pushResponse => pushResponse.body.completed === true), { verbose: true, errorMsg: 'Deal did not push successfully' });
      cy.request(dealPushStatus).then((pushResponse) => {
        if (pushResponse.body.log[0].output) {
          throw new Error(pushResponse.body.log[0].output.message);
        }
      });
    });

    it('Verify Edited GMP Programmatic Guaranteed Deal on DM', () => {
      const dealRequest = getRequest({
        url: `/api/v1/deal/${pgdealPayload.id}?with=dealBuyer,dealAdvertiser`,
      });

      cy.request(dealRequest).then((deal) => {
        const dealResponse = deal.body;
        const dealRespTargeting = deal.body.targeting;
        const dealTargeting = pgdealPayload.targeting;

        assert.equal(deal.status, 200, 'Successful response status value ');

        // Deal details validations
        assert.equal(dealResponse.name, pgdealPayload.name, 'Deal Name ');
        assert.equal(dealResponse.type, pgdealPayload.type.toUpperCase(), 'Deal type ');
        assert.equal(dealResponse.price, pgdealPayload.price, 'Rate ');
        assert.equal(dealResponse.target_spend, pgdealPayload.target_spend, 'Target Spend ');
        assert.equal(dealResponse.price_discount_percentage, pgdealPayload.price_discount_percentage, 'Discount Rate ');

        assert.equal(dealResponse.km_execution_id, pgdealPayload.km_execution_id, 'Execution ID ');
        assert.equal(dealResponse.km_format_id, pgdealPayload.km_format_id, 'Format ID ');
        assert.equal(dealResponse.start_date, pgdealPayload.start_date, 'Start Date ');
        assert.equal(dealResponse.end_date, pgdealPayload.end_date, 'End Date ');
        assert.equal(dealResponse.status, pgdealPayload.status, 'Status type ');

        assert.equal(dealResponse.site_list_id, pgdealPayload.site_list_id, 'Site-list Id ');
        assert.equal(dealResponse.site_list_type, pgdealPayload.site_list_type, 'Site-list type ');
        assert.equal(dealResponse.dealBuyer.bidder_id, pgdealPayload.dealBuyer.bidder_id, 'Bidder Id ');
        assert.equal(dealResponse.dealAdvertiser[0].km_advertiser_id, pgdealPayload.advertisers[0], 'Advertiser ID ');
        assert.equal(dealResponse.prioritize_inventory_targeting, pgdealPayload.prioritize_inventory_targeting, 'Prioritizing Inventory aka Editorial-Graph ');
        cy.task('log', 'Deal Info Matched');

        assert.equal(dealRespTargeting.optimizations.frequency_cap.day, dealTargeting.optimizations.frequency_cap.day, 'Frequency Cap Day ');
        assert.equal(dealRespTargeting.optimizations.frequency_cap.hour, dealTargeting.optimizations.frequency_cap.hour, 'Frequency Cap Hour ');
        assert.equal(dealRespTargeting.optimizations.frequency_cap.week, dealTargeting.optimizations.frequency_cap.week, 'Frequency Cap Week ');
        assert.equal(dealRespTargeting.optimizations.status_viewability, dealTargeting.optimizations.status_viewability, 'Viewability Status ');
        assert.equal(dealRespTargeting.optimizations.threshold_viewability, dealTargeting.optimizations.threshold_viewability, 'Viewability Threshold ');
        assert.equal(dealRespTargeting.optimizations.sample_rate_viewability, dealTargeting.optimizations.sample_rate_viewability, 'Viewability Sample Rate ');
        assert.equal(dealRespTargeting.os_targeting.included[0].name, dealTargeting.os_targeting.included[0].name, 'OS Targeting Name ');
        assert.equal(dealRespTargeting.os_targeting.included[0].value, dealTargeting.os_targeting.included[0].value, 'OS Targeting Type ');
        assert.equal(dealRespTargeting.browser_targeting.included[0].name, dealTargeting.browser_targeting.included[0].name, 'Browser Name ');
        assert.equal(dealRespTargeting.browser_targeting.included[0].value, dealTargeting.browser_targeting.included[0].value, 'Browser Type ');
        assert.equal(dealRespTargeting.device_targeting.included[0].name, dealTargeting.device_targeting.included[0].name, 'Device Name ');
        assert.equal(dealRespTargeting.device_targeting.included[0].value, dealTargeting.device_targeting.included[0].value, 'Device type ');
        assert.equal(dealRespTargeting.device_targeting.included[1].name, dealTargeting.device_targeting.included[1].name, '2nd Device Name ');
        assert.equal(dealRespTargeting.device_targeting.included[1].value, dealTargeting.device_targeting.included[1].value, '2nd Device Type ');
        assert.equal(isEqual(dealRespTargeting.geo_targeting.included, dealTargeting.geo_targeting.included), true, 'GeoTargeting Includes matches ');
        assert.equal(isEqual(dealRespTargeting.geo_targeting.excluded, dealTargeting.geo_targeting.excluded), true, 'GeoTargeting Excluded matches ');
        assert.equal(isEqual(dealRespTargeting.isp_targeting.included, dealTargeting.isp_targeting.included), true, 'ISP Targeting Included matches ');
        assert.equal(dealRespTargeting.custom_targeting[0].logicalOperator, dealTargeting.custom_targeting[0].logicalOperator, 'Logical Operator ');
        assert.equal(isEqual(dealRespTargeting.custom_targeting[0].children[0], dealTargeting.custom_targeting[0].children[0]), true, 'Citadel/Grapeshot object matches ');
        assert.equal(isEqual(dealRespTargeting.custom_targeting[0].children[1], dealTargeting.custom_targeting[0].children[1]), true, 'Krux/Mas object matches ');
        cy.task('log', 'Deal Targeting Matched');
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to SSP', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;
      dmBidder.name = 'GMP';

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const sspResponse = dmAdServerResponse.body.ssp;
        bidderSspId = sspResponse.bidder.id;
        cy.log(bidderSspId);

        assert.equal(sspResponse.status, 1, 'Response Status ');
        assert.equal(sspResponse.name, pgdealPayload.name, 'Deal Name ');
        assert.equal(sspResponse.bidder.name, dmBidder.name, 'Bidder Id ');
        assert.equal(sspResponse.external_id, pgdealPayload.id, 'Deal ID ');
        // assert.equal(sspResponse.bid_floor, dealPayload.price, 'Bid Floor ');
        assert.equal(sspResponse.deal_id, pgdealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(sspResponse.type, 'programmatic_guaranteed', 'Deal Type ');
        assert.equal(sspResponse.start_date, pgdealPayload.start_date, 'Deal Start Date ');
        assert.equal(sspResponse.ad_formats[0].id, pgdealPayload.km_format_id, 'Ad-Format ID ');
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to Athena', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const krakenResponse = dmAdServerResponse.body.athena_deal;
        const krakenTargeting = krakenResponse.targeting;
        const dealTargeting = pgdealPayload.targeting;

        assert.equal(dmAdServerResponse.status, 200, 'Successful response status value ');

        // Deal detailed info validations on Kraken
        assert.equal(krakenResponse.active, false, 'Active value '); // Testing against true since deal expected to be active
        assert.equal(krakenResponse.priority, 6, 'Priority value '); // Expected is 6 for the default value
        assert.equal(krakenResponse.pacingType, 'evenly', 'pacingType value '); // Expected is 'evenly' for the default value
        assert.equal(krakenResponse.CPM, pgdealPayload.price * 100, 'CPM value ');
        assert.equal(krakenResponse.bidder, bidderSspId, 'Bidder ID ');
        assert.equal(krakenResponse.dealID, pgdealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(krakenResponse.startDate.includes(pgdealPayload.start_date), true, 'Start Date value ');
        assert.equal(krakenResponse.endDate.includes(pgdealPayload.end_date.slice(0, -2)), true, 'End Date value '); // taking off day since kraken uses UTC
        assert.equal(krakenResponse.frequencyCap.day, dealTargeting.optimizations.frequency_cap.day, 'Frequency Cap Day ');
        assert.equal(krakenResponse.frequencyCap.hour, dealTargeting.optimizations.frequency_cap.hour, 'Frequency Cap Hour ');
        assert.equal(krakenResponse.frequencyCap.week, dealTargeting.optimizations.frequency_cap.week, 'Frequency Cap Week ');
        assert.equal(krakenResponse.viewabilitySampling, dealTargeting.optimizations.sample_rate_viewability, 'Viewability Sample Rate ');
        assert.equal(krakenResponse.viewabilityThreshold, dealTargeting.optimizations.threshold_viewability, 'Viewability Threshold ');

        // Targeting Verification
        assert.isAbove(krakenTargeting.adSlots.length, 0, 'Has at least 1 ad-slot '); // This is expect since site-list is being pushed
        assert.equal(krakenTargeting.os.include[0], dealTargeting.os_targeting.included[0].value, 'OS Targeting Type ');
        assert.equal(krakenTargeting.runOfNetwork, !pgdealPayload.site_list_type, 'Run Of Network status ');
        assert.equal(krakenTargeting.editorialGraph, pgdealPayload.prioritize_inventory_targeting, 'Editorial-Graph status ');
        assert.equal(krakenTargeting.browser.include[0], dealTargeting.browser_targeting.included[0].value, 'Browser Type ');
        assert.equal(krakenTargeting.socialBrowser.include[0], dealTargeting.social_targeting.included[0].value, 'Social-Browser Type values ');
        assert.equal(isEqual(krakenTargeting.isp.include[0], dealTargeting.isp_targeting.included[0].name), true, 'ISP Targeting Included matches ');
        assert.equal(krakenTargeting.deviceType.include.includes(dealTargeting.device_targeting.included[0].value), true, '1st Device Type found in Response');
        assert.equal(krakenTargeting.deviceType.include.includes(dealTargeting.device_targeting.included[1].value), true, '2nd Device Type found in Response ');
        assert.equal(krakenTargeting.adSlotTargetingType.includes(pgdealPayload.site_list_type.toLowerCase().slice(0, -4)), true, 'Site-list status matches ');

        assert.equal(krakenTargeting.custom.logicalOperator, dealTargeting.custom_targeting[0].logicalOperator, 'Logical Operator ');
        assert.equal(krakenTargeting.custom.children[0].children[0].keyName, dealTargeting.custom_targeting[0].children[0].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[0].children[0].valueNames[0], dealTargeting.custom_targeting[0].children[0].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[0].children[0].operator, 'IS', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[0].children[1].keyName, dealTargeting.custom_targeting[0].children[1].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[0].children[1].valueNames[0], dealTargeting.custom_targeting[0].children[1].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[0].children[1].operator, 'IS_NOT', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[1].children[0].keyName, dealTargeting.custom_targeting[1].children[0].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[1].children[0].valueNames[0], dealTargeting.custom_targeting[1].children[0].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[1].children[0].operator, 'IS', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[1].children[1].keyName, dealTargeting.custom_targeting[1].children[1].keyName, 'Key Name ');
        assert.equal(krakenTargeting.custom.children[1].children[1].valueNames[0], dealTargeting.custom_targeting[1].children[1].keyValues[0].key, 'Value Name ');
        assert.equal(krakenTargeting.custom.children[1].children[1].operator, 'IS_NOT', 'Key Operator ');

        assert.equal(krakenTargeting.custom.children[1].logicalOperator, dealTargeting.custom_targeting[1].logicalOperator, 'Logical Operator between the groups ');

        // custom logic needed for geo-targeting verification
        // logic need for discount cpm verification

        // equal(krakenResponse.adFormat, 8,); // will figure out later why ad-format is 8; need ad-format call, 8 is in-hub id
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to DV360 Product', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const dvProduct = dmAdServerResponse.body.dv360_product;

        assert.equal(dvProduct.displayName, pgdealPayload.name, 'Deal Name ');
        assert.equal(dvProduct.pricingType, 'FIXED_PRICE', 'pricing Type ');
        assert.equal(dvProduct.rateDetails.rateType, 'CPM', 'rate Type ');
        assert.equal(dvProduct.transactionType, 'RESERVED', 'transaction Type ');
        assert.equal((dvProduct.endTime.slice(0, -10)), pgdealPayload.end_date, 'end Time ');
        assert.equal((dvProduct.startTime.slice(0, -10)), pgdealPayload.start_date, 'start date ');
        assert.equal(dvProduct.creativeConfig[0].creativeType, 'CREATIVE_TYPE_DISPLAY', 'creative Type ');
        assert.equal(dvProduct.externalDealId, pgdealPayload.deal_id, 'Deal Hash ID ');
        assert.equal(dvProduct.rateDetails.rateType, 'CPM', 'Rate Type ');
        assert.equal(dvProduct.rateDetails.rate.currencyCode, 'USD', 'Rate Type ');
      });
    });

    it('Verify GMP Programmatic Guaranteed Deal data sent to DV360 Order', () => {
      const dmAdServerRequest = getRequest();
      dmAdServerRequest.url = `/api/v1/deal/${pgdealPayload.id}/integrations`;

      cy.request(dmAdServerRequest).then((dmAdServerResponse) => {
        const dvOrder = dmAdServerResponse.body.dv360_order;

        assert.equal(dvOrder.displayName, pgdealPayload.name, 'Deal Name ');
        assert.equal(dvOrder.publisherName, 'Kargo', 'publisherName ');
        assert.equal(dvOrder.status, 'PENDING_ACCEPTANCE', 'status at DV360 order ');
        assert.equal(dvOrder.partnerId[0], '10005', 'Partner ID ');
      });
    });

    it('Archive GMP Programmatic Guaranteed Deal', () => {
      const dealArchiveRequest = getRequest({
        method: 'DELETE',
        url: `/api/v1/deal/${pgdealPayload.id}`,
      });

      cy.request(dealArchiveRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Response status value ');
        assert.equal(dealResponse.body, 'Model deleted', 'Deal status : ');
      });
    });

    it('Unarchive GMP Programmatic Guaranteed Rate Deal', () => {
      const dealUnarchiveRequest = getRequest({
        method: 'PUT',
        url: `/api/v1/deal/${pgdealPayload.id}/unarchive`,
      });

      cy.request(dealUnarchiveRequest).then((dealResponse) => {
        assert.equal(dealResponse.status, 200, 'Response status value ');
        assert.isAbove(dealResponse.body.id, 0, 'id is greater than 0 ');
      });
    });
  });
});
