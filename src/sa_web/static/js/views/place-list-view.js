/*globals Backbone _ jQuery Handlebars */

var Shareabouts = Shareabouts || {};

(function(S, $, console) {
  // Handlebars support for Marionette
  Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(rawTemplate) {
    return Handlebars.compile(rawTemplate);
  };

  S.PlaceListItemView = Backbone.Marionette.Layout.extend({
    template: '#place-detail',
    tagName: 'li',
    className: 'clearfix',
    regions: {
      support: '.support'
    },
    modelEvents: {
      'show': 'show',
      'hide': 'hide',
      'change': 'render'
    },
    initialize: function() {
      var supportType = S.Config.support.submission_type;
      this.model.submissionSets[supportType] = this.model.submissionSets[supportType] ||
        new S.SubmissionCollection(null, {
          submissionType: supportType,
          placeModel: this.model
        });

      this.supportView = new S.SupportView({
        collection: this.model.submissionSets[S.Config.support.submission_type],
        supportConfig: S.Config.support,
        userToken: S.Config.userToken
      });
    },
    onRender: function(evt) {
      this.support.show(this.supportView);
    },
    show: function() {
      this.$el.show();
    },
    hide: function() {
      this.$el.hide();
    }
  });

  S.PlaceListView = Backbone.Marionette.CompositeView.extend({
    template: '#place-list',
    itemView: S.PlaceListItemView,
    itemViewContainer: '.place-list',
    ui: {
      searchField: '#list-search',
      searchForm: '.list-search-form',
      allSorts: '.list-sort-menu a',
      date: '.date-sort',
      surveyCount: '.survey-sort',
      supportCount: '.support-sort',
      searchFilter: '#list-search-filter',
      iconSelectImg: '.icon_selectable'
    },
    events: {
      'input @ui.searchField': 'handleSearchInput',
      'click @ui.searchFilter': 'handleSearchInput',
      'submit @ui.searchForm': 'handleSearchSubmit',
      'click @ui.date': 'handleDateSort',
      'click @ui.surveyCount': 'handleSurveyCountSort',
      'click @ui.supportCount': 'handleSupportCountSort',
      'click @ui.iconSelectImg': 'handleIconSelectImage'
    },
    initialize: function(options) {
      options = options || {};
      
      // Init the views cache
      this.views = {};

      // Set the default sort
      this.sortBy = 'date';
     
      // Initialize the list filter
      this.collectionFilters = options.filter || {};
      this.searchTerm = options.term || '';
    },
    onAfterItemAdded: function(view) {
      // Cache the views as they are added
      this.views[view.model.cid] = view;
    },
    renderList: function() {
      // A faster alternative to this._renderChildren. _renderChildren always
      // discards and recreates a new ItemView. This simply rerenders the
      // cached views.
      var $itemViewContainer = this.getItemViewContainer(this);
      $itemViewContainer.empty();
      this.collection.each(function(model) {
        $itemViewContainer.append(this.views[model.cid].$el);
        // Delegate the events so that the subviews still work
        this.views[model.cid].supportView.delegateEvents();
      }, this);
    },
    handleSearchInput: function(evt) {
      var filters = {};
      var filter_values = this.ui.searchFilter.val().split(',');
      if (filter_values[0] === '') {
        filter_values = [];
      }
      
      // loop through filter values and setup filters...
      for (var i in filter_values) {
        var item = filter_values[i].split('|');
        if (['location_type','hint_category'].indexOf(item[0]) !== -1) {
          if (Array.isArray(filters[item[0]])) {
            filters[item[0]].push(item[1]);
          } else {
            filters[item[0]] = [item[1]];
          }
        } else {
          filters[item[0]] = item[1]; 
        }
      }
      evt.preventDefault();
      this.search(this.ui.searchField.val());
      this.filter(filters);
//      this.filter({'location_type':['bus','bicycle']})
    },
    handleIconSelectImage: function(evt) {
      evt.preventDefault();
      var icon = evt['target'];
      var id = $(icon).attr('id');
      var types = id.split('-');
      var parse_str = types[0]+'|'+types[1];
      var val =  this.ui.searchFilter.val().split(',');
      // reset val to empty array because javascript
      if (val[0] === '') {
        val = [];
      }
      // if the icon is selected, lets remove it
      // and its selected class
      if ($(icon).hasClass('icon_selected')) {
        $(icon).removeClass('icon_selected');
        var index = val.indexOf(parse_str);
        if (index !== -1) {
          val.splice(index,1);
        }
        // remove it from collection filters too!
        var index = this.collectionFilters[types[0]].indexOf(types[1]);
        if (index !== -1) {
          this.collectionFilters[types[0]].splice(index,1);
          // delete the entry entirely if empty
          if (this.collectionFilters[types[0]].length === 0) {
            delete this.collectionFilters[types[0]];
          }
        }
      // now we're going to add it...
      } else {
        $(icon).addClass('icon_selected');
        var index = val.indexOf(parse_str);
        if (index === -1) {
          val.push(parse_str);
        }
      }
      // update the filter field
      this.ui.searchFilter.val(val);
      // click it too
      this.ui.searchFilter.click();
    },
    handleSearchSubmit: function(evt) {
      evt.preventDefault();
      this.search(this.ui.searchField.val());
    },
    handleDateSort: function(evt) {
      evt.preventDefault();

      this.sortBy = 'date';
      this.sort();

      this.updateSortLinks();
    },
    handleSurveyCountSort: function(evt) {
      evt.preventDefault();

      this.sortBy = 'surveyCount';
      this.sort();

      this.updateSortLinks();
    },
    handleSupportCountSort: function(evt) {
      evt.preventDefault();

      this.sortBy = 'supportCount';
      this.sort();

      this.updateSortLinks();
    },
    updateSortLinks: function() {
      this.ui.allSorts.removeClass('is-selected');
      this.ui[this.sortBy].addClass('is-selected');
    },
    dateSort: function(a, b) {
      if (a.get('created_datetime') > b.get('created_datetime')) {
        return -1;
      } else {
        return 1;
      }
    },
    surveyCountSort: function(a, b) {
      var submissionA = a.submissionSets[S.Config.survey.submission_type],
          submissionB = b.submissionSets[S.Config.survey.submission_type],
          aCount = submissionA ? submissionA.size() : 0,
          bCount = submissionB ? submissionB.size() : 0;

      if (aCount === bCount) {
        if (a.get('created_datetime') > b.get('created_datetime')) {
          return -1;
        } else {
          return 1;
        }
      } else if (aCount > bCount) {
        return -1;
      } else {
        return 1;
      }
    },
    supportCountSort: function(a, b) {
      var submissionA = a.submissionSets[S.Config.support.submission_type],
          submissionB = b.submissionSets[S.Config.support.submission_type],
          aCount = submissionA ? submissionA.size() : 0,
          bCount = submissionB ? submissionB.size() : 0;

      if (aCount === bCount) {
        if (a.get('created_datetime') > b.get('created_datetime')) {
          return -1;
        } else {
          return 1;
        }
      } else if (aCount > bCount) {
        return -1;
      } else {
        return 1;
      }
    },
    sort: function() {
      var sortFunction = this.sortBy + 'Sort';

      this.collection.comparator = this[sortFunction];
      this.collection.sort();
      this.renderList();
      this.search(this.ui.searchField.val());
    },
    clearFilters: function() {
      this.collectionFilters = {};
      this.applyFilters(this.collectionFilters, this.searchTerm);
    },
    filter: function(filters) {
      _.extend(this.collectionFilters, filters);
      this.applyFilters(this.collectionFilters, this.searchTerm);
    },
    search: function(term) {
      this.searchTerm = term;
      this.applyFilters(this.collectionFilters, this.searchTerm);
    },
    applyFilters: function(filters, term) {
      var len = S.Config.place.items.length,
          val, key, i;

      term = term.toUpperCase();
      this.collection.each(function(model) {
        var show = function() { model.trigger('show'); },
            hide = function() { model.trigger('hide'); },
            submitter, locationType;

        //filters['location_type'] = 'bicycle';
  
        // If the model doesn't match one of the filters, hide it.
        for (key in filters) {
          if (['location_type','hint_category'].indexOf(key) !== -1) {
            //special condition for location_type
            var values = filters[key];
            if (!Array.isArray(values)) {
              values = [values]; 
            }
            var hit = false;
            for (var v in values) {
              var val = values[v].toUpperCase();
              if (val == model.get(key).toUpperCase()) {
                hit = true;
                break;
              }
            }
            if (hit === false) {
              return hide();
            }
          } else {
            if (filters[key] === undefined) continue;
            val = filters[key].toUpperCase();
            if (val !== model.get(key).toUpperCase()) {
              return hide();
            }
          }
        }

        // Check whether the remaining models match the search term
        for (i=0; i<len; i++) {
          key = S.Config.place.items[i].name;
          val = model.get(key);
          if (_.isString(val) && val.toUpperCase().indexOf(term) !== -1) {
            return show();
          }
        }

        // Submitter is only present when a user submits a place when logged in
        // with FB or Twitter. We handle it specially because it is an object,
        // not a string.
        submitter = model.get('submitter');
        if (!show && submitter) {
          if (submitter.name && submitter.name.toUpperCase().indexOf(term) !== -1 ||
              submitter.username && submitter.username.toUpperCase().indexOf(term) !== -1) {
            return show();
          }
        }

        // If the location_type has a label, we should search in it also.
        locationType = S.Config.flavor.place_types[model.get('location_type')];
        if (!show && locationType && locationType.label) {
          if (locationType.label.toUpperCase().indexOf(term) !== -1) {
            return show();
          }
        }

        // If we've fallen through here, hide the item.
        return hide();
      });
    },
    isVisible: function() {
      return this.$el.is(':visible');
    }
  });

}(Shareabouts, jQuery, Shareabouts.Util.console));
