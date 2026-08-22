import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig, defaultLocaleFactory } from './app/app.config';
import { App } from './app/app';

defaultLocaleFactory();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
