import { Injectable } from '@angular/core';
import { Observable, Subject,of } from 'rxjs';
import { map, switchMap, take, } from 'rxjs/operators';
import { AbpApplicationConfigurationService } from '../proxy/volo/abp/asp-net-core/mvc/application-configurations/abp-application-configuration.service';
import { AbpApplicationLocalizationService } from '../proxy/volo/abp/asp-net-core/mvc/application-configurations/abp-application-localization.service';
import {
  ApplicationConfigurationDto,
  ApplicationGlobalFeatureConfigurationDto,
} from '../proxy/volo/abp/asp-net-core/mvc/application-configurations/models';
import { InternalStore } from '../utils/internal-store-utils';

@Injectable({
  providedIn: 'root',
})
export class ConfigStateService {
  private readonly store = new InternalStore({} as ApplicationConfigurationDto);
  private includeLocalizationResources = false;

  get createOnUpdateStream() {
    return this.store.sliceUpdate;
  }

  private updateSubject = new Subject<void>();

  constructor(
    private abpConfigService: AbpApplicationConfigurationService,
    private abpApplicationLocalizationService: AbpApplicationLocalizationService,
  ) {
    this.initUpdateStream();
  }

  private initUpdateStream() {
    this.updateSubject
      .pipe(
        switchMap(() =>
          this.abpConfigService.get({
            includeLocalizationResources: this.includeLocalizationResources,
          }),
        ),
      )
      .pipe(switchMap(appState => this.getLocalizationAndCombineWithAppState(appState)))
      .subscribe(res => {
        return this.store.set(res);
      });
  }

  private getLocalizationAndCombineWithAppState(
    appState: ApplicationConfigurationDto,
  ): Observable<ApplicationConfigurationDto> {
    return this.abpApplicationLocalizationService
      .get({ cultureName: appState.localization.currentCulture.name, onlyDynamics: false })
      .pipe(
        switchMap(result =>
          of({ ...appState, localization: { ...appState.localization, ...result } }),
        ),
      );
  }

  refreshAppState() {
    this.updateSubject.next();
    return this.createOnUpdateStream(state => state).pipe(take(1));
  }

  getOne$(key: string) {
    return this.store.sliceState(state => state[key]);
  }

  getOne(key: string) {
    return this.store.state[key];
  }

  getAll$(): Observable<ApplicationConfigurationDto> {
    return this.store.sliceState(state => state);
  }

  getAll(): ApplicationConfigurationDto {
    return this.store.state;
  }

  getDeep$(keys: string[] | string): Observable<any> {
    keys = splitKeys(keys);

    return this.store
      .sliceState(state => state)
      .pipe(
        map(state => {
          return (keys as string[]).reduce((acc: any, val) => {
            if (acc) {
              return acc[val];
            }

            return undefined;
          }, state);
        }),
      );
  }

  getDeep(keys: string[] | string): any {
    keys = splitKeys(keys);

    return (keys as string[]).reduce((acc: any, val) => {
      if (acc) {
        return acc[val];
      }

      return undefined;
    }, this.store.state);
  }

  getFeature(key: string) {
    return this.store.state.features?.values?.[key];
  }

  getFeature$(key: string) {
    return this.store.sliceState(state => state.features?.values?.[key]);
  }

  getFeatures(keys: string[]) {
    const { features } = this.store.state;
    if (!features) return;

    return keys.reduce((acc, key) => ({ ...acc, [key]: features.values[key] }), {});
  }

  getFeatures$(keys: string[]) {
    return this.store.sliceState(({ features }) => {
      if (!features?.values) return;

      return keys.reduce((acc, key) => ({ ...acc, [key]: features.values[key] }), {});
    });
  }

  getSetting(key: string) {
    return this.store.state.setting?.values?.[key];
  }

  getSetting$(key: string) {
    return this.store.sliceState(state => state.setting?.values?.[key]);
  }

  getSettings(keyword?: string) {
    const settings = this.store.state.setting?.values || {};

    if (!keyword) return settings;

    const keysFound = Object.keys(settings).filter(key => key.indexOf(keyword) > -1);

    return keysFound.reduce((acc, key) => {
      acc[key] = settings[key];
      return acc;
    }, {});
  }

  getSettings$(keyword?: string) {
    return this.store
      .sliceState(state => state.setting?.values)
      .pipe(
        map((settings = {}) => {
          if (!keyword) return settings;

          const keysFound = Object.keys(settings).filter(key => key.indexOf(keyword) > -1);

          return keysFound.reduce((acc, key) => {
            acc[key] = settings[key];
            return acc;
          }, {});
        }),
      );
  }

  getGlobalFeatures() {
    return this.store.state.globalFeatures;
  }

  getGlobalFeatures$() {
    return this.store.sliceState(state => state.globalFeatures);
  }

  private isGlobalFeatureEnabled(
    key: string,
    globalFeatures: ApplicationGlobalFeatureConfigurationDto,
  ) {
    const features = globalFeatures.enabledFeatures || [];
    return features.some(f => key === f);
  }

  getGlobalFeatureIsEnabled(key: string) {
    return this.isGlobalFeatureEnabled(key, this.store.state.globalFeatures);
  }

  getGlobalFeatureIsEnabled$(key: string) {
    return this.store.sliceState(state => this.isGlobalFeatureEnabled(key, state.globalFeatures));
  }
}

function splitKeys(keys: string[] | string): string[] {
  if (typeof keys === 'string') {
    keys = keys.split('.');
  }

  if (!Array.isArray(keys)) {
    throw new Error('The argument must be a dot string or an string array.');
  }

  return keys;
}
