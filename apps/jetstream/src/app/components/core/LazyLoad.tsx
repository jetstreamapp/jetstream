/**
 * https://github.com/ianschmitz/react-lazy-with-preload
 * MIT License
 *
 * Copyright (c) 2019 Ian Schmitz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { ComponentType, createElement, forwardRef, lazy } from 'react';

export type PreloadableComponent<T extends ComponentType<unknown>> = T & {
  preload: () => Promise<void>;
};

export default function lazyWithPreload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>): PreloadableComponent<T> {
  const LazyComponent = lazy(factory);
  let factoryPromise: Promise<void> | undefined;
  let LoadedComponent: T | undefined;

  const Component = forwardRef(function LazyWithPreload(props, ref) {
    return createElement(LoadedComponent ?? LazyComponent, Object.assign(ref ? { ref } : {}, props) as unknown);
  }) as unknown as PreloadableComponent<T>;

  Component.preload = () => {
    if (!factoryPromise) {
      factoryPromise = factory().then((module) => {
        LoadedComponent = module.default;
      });
    }

    return factoryPromise;
  };
  return Component;
}
