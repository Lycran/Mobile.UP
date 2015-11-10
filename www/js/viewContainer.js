define([
    'jquery',
    'underscore',
    'backbone',
    'backboneMVC',
    'underscore-string',
    'utils',
    'q',
    'history',
    'contentLoader'
], function($, _, Backbone, BackboneMVC, _str, utils, Q, customHistory, contentLoader) {

    var viewContainer = _.extend({

        initialize: function() {
            _.bindAll(this, "notifyMissingServerConnection", "removeActiveElementsOnCurrentPage");

            this.listenTo(this, "beforeTransition", this.saveAndPrepareScrollPosition);
            this.listenTo(this, "beforeTransition", function(options) { customHistory.push(options.route.to); });
            this.listenTo(this, "afterTransition", this.afterTransition);
        },

        setIosHeaderFix: function () {
            if ($.os.ios7) {
                $('body').addClass('ios-statusbar');
            }
        },

        setReverseSlidefadeTransition: function () {
            $.mobile.changePage.defaults.transition = 'slidefade';
            $.mobile.changePage.defaults.reverse = 'reverse';
        },

        _updateHeaderWithMetaInfos: function($el, page) {
            //Meta infos aus Seite in den Header integrieren
            var $metas = $el.find('meta');
            if ($metas.length > 0) {
                var metas = {};
                $metas.each(function () {
                    metas[$(this).attr('name')] = $(this).attr('content');
                });

                if (!metas.title && page) {
                    metas.title = page.title;
                } else if (!metas.title && !page) {
                    metas.title = $('.ui-header').find('h1').html();
                }

                var header = utils.renderheader(metas);
                $pageContainer.find('.ui-header').replaceWith(header);
            }
        },

        _ensureFooterFixed: function(page) {
            var $footer = $pageContainer.find('.ui-footer');
            if ($footer.length > 0) {
                page.content.addClass('ui-page-footer-fixed');
            }
        },

        finishRendering: function (content, page) {
            content.render();

            this._updateHeaderWithMetaInfos(content.$el, page);
            this._ensureFooterFixed(page);

            if (content.afterRender)
                content.afterRender();
            $pageContainer.trigger("create");
        },

        saveAndPrepareScrollPosition: function (transitionOptions) {
            scrollManager.saveScrollPositionExtract(transitionOptions);
            scrollManager.prepareScrollPositionExtract(transitionOptions.route.to);
        },

        executeTransition: function (transitionOptions) {
            this.trigger("beforeTransition", transitionOptions);

            Q($.mobile.changePage(transitionOptions.page.content, {
                changeHash: false,
                transition: transitionOptions.transition,
                reverse: transitionOptions.reverse
            })).done(_.bind(function () {
                if (!app.currentView) {
                    $('body').css('overflow', 'auto');
                    $("body").fadeIn(100);
                }
                app.currentView = transitionOptions.page.view;

                this.trigger("afterTransition", transitionOptions);
            }, this));
        },

        /**
         * Wird nach Pagetransition ausgef�hrt
         */
        afterTransition: function(transitionOptions) {
            var c = transitionOptions.extras.c;
            var a = transitionOptions.extras.a;
            var page = transitionOptions.extras.page;
            var params = transitionOptions.extras.params;
            var q = transitionOptions.extras.q;

            contentLoader.initData(c);
            var content = viewContainer.createViewForName(c, a, page, params);
            contentLoader.retreiveOrFetchContent(content, {}, params, c, a, function(d) {
                if (content) {
                    viewContainer.finishRendering(content, transitionOptions.page);
                }
                q.resolve(d, content);
            });
        },

        updateHeader: function ($el) {
            this._updateHeaderWithMetaInfos($el);
        },

        /**
         * @param c Controllername
         * @param a Actionsname
         * @param page
         * @param params
         * @returns Instance of Backbone.View or false
         */
        createViewForName: function (c, a, page, params) {
            params.page = page.$el;

            var content = false;
            var view;
            if (this.hasView(c, a)) { //Wenn eine View-Klasse f�r Content vorhanden ist: ausf�hren
                view = this.instanciateView(c, a, params);
                view.page = page.$el;
                content = view;
            } else { //Wenn keine Viewklasse vorhanden ist, die page als view nehmen
                view = page;
                this._updateHeaderWithMetaInfos(page.$el);
            }
            app.currentView = view; //app.currentView kann als Referenz im HTML z.b. im onclick-Event verwendet werden

            return content;
        },

        /*
         * Momentan aktive Seite zur�ckgeben
         */
        activePageExtract: function () {
            return $.mobile.activePage;
        },

        activeCon: function() {
            return this.activeConExtract();
        },

        /*
         * InhaltsContainer der momentan aktiven Seite zur�ckgeben
         */
        activeConExtract: function () {
            return $('.ui-content', this.activePageExtract());
        },

        animateHeaderAndFooter: function (a) {
            var toPage = a.toPage;
            if (typeof(a.toPage) != 'string') {
                var header = $('.header', toPage);
                var footer = $('.footer', toPage);
                var duration = 350, animating = 'footer';
                window.footerAnimating = true;
                var dir = window.reverseTransition ? 1 : -1; //Transitionsrichtung f�r Footeranimation ermitteln
            }
        },

        notifyMissingServerConnection: function (app) {
            $('.ui-btn-active', this.activePageExtract()).removeClass('ui-btn-active'); //Aktuell fokussierten Button deaktivieren, dass die selektierungsfarbe verschwindet
            app.previous(true);
            var s = 'Es konnte keine Verbindung zum Server hergestellt werden. Bitte �berpr�fe deine Internetverbindung';
            if (navigator.notification) //�ber Plugin f�r App
                navigator.notification.alert(s, null, 'Kein Internet'); //Fehlermeldung ausgeben
            else
                alert(s); //F�r Browser
        },

        removeActiveElementsOnCurrentPage: function() {
            $('.ui-btn-active', this.activePageExtract()).removeClass('ui-btn-active');
        },

        /**
         * prepare new view for DOM display
         */
        prepareViewForDomDisplay: function (c, params) {
            var page = this.instanciatePage(c, params);

            // Render page
            page.render();

            // Add padding for the header and append it to the pagecontainer
            var pageContent = page.$el.attr("data-role", "page");
            pageContent.css('padding-top', '54px');
            $pageContainer = $('#pagecontainer');
            $pageContainer.append(pageContent);
            $pageContainer.trigger("create");

            // Retrieve header title, render header and replace it
            var pageTitle = pageContent.find('meta[name="title"]').attr('content');
            var $header = $pageContainer.find('.ui-header');
            var header = utils.renderheader({title: pageTitle});
            if ($header.length > 0) {
                $header.replaceWith(header);
            } else {
                $pageContainer.append(header);
            }

            // Retrieve transitions
            var transition = $.mobile.defaultPageTransition;
            var reverse = $.mobile.changePage.defaults.reverse;

            // Erste Seite nicht sliden
            if (this.firstPage) {
                transition = 'none';
                this.firstPage = false;
            }

            return {
                transition: transition,
                reverse: reverse,
                page: {
                    title: pageTitle,
                    content: pageContent,
                    view: page
                }
            };
        },

        instanciatePage: function(c, params) {
           return this.instanciateView(c, 'Page', params);
        },

        instanciateView: function(c, a, params) {
            var View = this.getView(c, a);
            return new View(params);
        },

        hasView: function(c, a) {
            return app.views[utils.capitalize(c) + utils.capitalize(a)];
        },

        getView: function (c, a) {
            var pageName = utils.capitalize(c) + utils.capitalize(a);
            if (!app.views[pageName]) {
                app.views[pageName] = utils.EmptyPage;
            }
            return app.views[pageName];
        }
    }, Backbone.Events);

    var scrollManager = {
        routesToScrollPositions: {},

        saveScrollPositionExtract: function (transitionOptions) {
            var name = transitionOptions.route.from;
            if (name) {
                this.routesToScrollPositions[name] = $(window).scrollTop();
            }
        },

        prepareScrollPositionExtract: function (route) {
            var pos = 0;
            //alert(route);
            if (this.routesToScrollPositions[route]) {
                pos = this.routesToScrollPositions[route];
                delete this.routesToScrollPositions[route]
            }

            // We only have one active page because jQuery mobiles custom history is disabled
            var activePage = $.mobile.navigate.history.getActive();
            activePage.lastScroll = pos;
        }
    };

    return {
        viewContainer: viewContainer,
        scrollManager: scrollManager
    };
});
