import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createAppStore } from '../store';

export function renderWithStore(
  ui,
  {
    preloadedState,
    route = '/',
    store: providedStore,
    extraReducers,
    routeResetScope,
    ...renderOptions
  } = {},
) {
  const store =
    providedStore ||
    createAppStore({ preloadedState, extraReducers, routeResetScope });

  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export function renderWithProviders(
  ui,
  { route = '/', store, preloadedState, extraReducers, ...renderOptions } = {},
) {
  return renderWithStore(ui, {
    route,
    store,
    preloadedState,
    extraReducers,
    ...renderOptions,
  });
}

export * from '@testing-library/react';
