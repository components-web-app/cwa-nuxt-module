---
layout: default
title: Home
nav_order: -9999
---

# CWA Modules Documentation
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

* TOC
{:toc}

## Setup notes, to do and discuss
- decide on linting tools and configuration
- decide on a test framework - Jest/Ava?
- choose and configure compiling
- how do we test with a dummy/test application using the features we build?
- should we test by spinning up the API Component Bundle real API or simulate responses?. If we spin up API Component Bundle, in CI can we test with multiple versions if we decide to support major version releases
- CI integration
- Testing the real application will require a dummy database. Do we need to dockerise for local testing or can we run the test application using sqlite?

## Server
### No longer required - logouts will pass to API which will delete the refresh token. THe application should implement session timeout system after a period of inactivity.
This isn't actually a Nuxt module in itself. But it is useful to have some server utilities that we can easily use in our application's `/server/index.spec` file. You can see an example of how we were using this in version 1 [here](https://github.com/silverbackis/ComponentsWebApp/blob/master/app/server/index.spec).

The main reason to have this is to provide JWT authentication management. We should be storing refresh tokens for the user's current 'ExpressJS' session and ensuring that the user never gets the refresh token. You can see the v1 server file [here](https://github.com/silverbackis/CWAModules/blob/master/packages/server/src/index.spec).

We also have utilities here to save cookies as seen [here](https://github.com/silverbackis/CWAModules/blob/master/packages/server/src/utilities.js).

The `getFormId` should really be in the `@cwa-modules/core` package.

## Core
This is the main Nuxt module which is to handle communication with the API and storage of the resources. The v1 package can be found [here](https://github.com/silverbackis/CWAModules/tree/master/packages/core/lib)

### Configuration
The configuration options should allow a user to override the Vuex store's namespace.

We can prepend configuration to other modules (e.g. the nuxt auth module) by using similar methods as used [here](https://github.com/nuxt-community/pwa-module/blob/dev/lib/module.js)

### Plugins
We currently automatically include the `vue-cookie` plugin as this is helpful in our components to dealing with the JWT authentication cookies.

We can also include mixins that are useful across any Nuxt component, although the mixin that was configured in v1 should not be implemented and instead we should include these mixins when necessary for v2.

### Main features
Primarily this package should provide middleware which is loading 