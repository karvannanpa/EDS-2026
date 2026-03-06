# React Integration Analysis - EDS Project

## Project Overview

This is an **Adobe Experience Manager (AEM) Boilerplate** project that integrates React components into a traditional AEM block-based architecture. The project uses Webpack to bundle React components and integrates them seamlessly with the existing AEM block system.

---

## How React is Included

### 1. **Dependencies** (`package.json`)

React is included as a production dependency:
- `react: ^18.2.0` - React library
- `react-dom: ^18.2.0` - React DOM rendering library

Development dependencies for React:
- `@babel/preset-react: ^7.23.3` - Babel preset for JSX transformation
- `@types/react: ^18.3.3` - TypeScript definitions
- `@types/react-dom: ^18.0.0` - TypeScript definitions for React DOM
- `babel-loader: ^9.1.3` - Webpack loader for Babel

### 2. **Babel Configuration** (`.babelrc`)

```json
{
  "presets": ["@babel/preset-react"]
}
```

This configuration tells Babel to transform JSX syntax into JavaScript that browsers can understand.

### 3. **Webpack Configuration** (`webpack.config.cjs`)

Webpack is configured to:
- **Entry Points**: Automatically discovers all React components in `./react-app/app/*/*.{jsx,tsx}`
- **Output**: Generates ES modules (`library.type: 'module'`) for each React component
- **Loaders**: 
  - `babel-loader` processes JSX/JS files
  - `css-loader` + `MiniCssExtractPlugin` handles CSS imports
- **Output Format**: Each React component is bundled as a separate ES module

---

## React Workflow - Step by Step

### **Phase 1: Development & Build**

#### Step 1: React Component Development
**Location**: `react-app/app/{block-name}/`

Example structure for the `banner` block:
```
react-app/app/banner/
├── index.jsx          # Entry point, exports decorateBlock function
├── components/
│   └── app.jsx        # React component
└── styles/
    └── index.css      # Component styles
```

**Key Files**:
- `react-app/app/banner/index.jsx`: 
  - Imports React and ReactDOM
  - Exports `decorateBlock(block)` function that creates a React root and renders the component
  - Uses `createRoot` from `react-dom/client` (React 18 API)
  
- `react-app/app/banner/components/app.jsx`:
  - Standard React functional component
  - Returns JSX

#### Step 2: Webpack Build Process

**Command**: `npm run react:build` or `npm run react:start`

**Process**:
1. **Entry Discovery**: Webpack scans `./react-app/app/*/*.{jsx,tsx}` and creates entry points for each component
   ```javascript
   entry: glob.sync('./react-app/app/*/*.{jsx,tsx}').reduce((obj, el) => {
     const compName = path.parse(el).dir.split('/').pop();
     obj[compName] = `./${el}`;
     return obj;
   }, {})
   ```

2. **Transformation**:
   - JSX files → Babel transforms JSX to JavaScript
   - CSS imports → Extracted to separate CSS files via `MiniCssExtractPlugin`
   - React imports → Bundled (except vendor chunk)

3. **Code Splitting**:
   - **Vendor Chunk**: React and ReactDOM are extracted to `vendor/vendor.js`
   - **Component Chunks**: Each React component becomes its own module
   - **CSS Files**: Extracted to `[name]/[name].css`

4. **Output**:
   ```
   dist/default/
   ├── banner/
   │   ├── banner.js    # ES module with React component
   │   └── banner.css   # Component styles
   └── vendor/
       └── vendor.js    # React + ReactDOM bundle
   ```

#### Step 3: File Copying (Post-Build)

After webpack builds, the `CopyFiles` plugin copies files:
- Component JS/CSS → `./blocks/{block-name}/`
- Vendor JS → `./scripts/vendor/`
- Styles → `./styles/`

This makes the built files available to the AEM block system.

---

### **Phase 2: Runtime Execution**

#### Step 4: HTML Page Load

**Location**: `static/index.html` or AEM-generated HTML

The HTML contains block markup:
```html
<div class="banner">
  <!-- Block content -->
</div>
```

#### Step 5: Block Initialization (`scripts/aem.js`)

When the page loads, `scripts.js` calls:
1. `loadEager()` → `decorateMain()` → `decorateBlocks()`
2. `loadLazy()` → `loadSections()` → `loadBlock()` for each block

**Block Loading Process** (`loadBlock` function):
```javascript
async function loadBlock(block) {
  const { blockName } = block.dataset; // e.g., "banner"
  
  // 1. Load CSS
  loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`);
  
  // 2. Dynamically import the JS module
  const mod = await import(
    `${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.js`
  );
  
  // 3. Call the default export (decorate function)
  if (mod.default) {
    await mod.default(block);
  }
}
```

#### Step 6: React Component Rendering

When `mod.default(block)` is called, it executes `decorateBlock()` from `react-app/app/banner/index.jsx`:

```javascript
export async function decorateBlock(block, blockConfig) {
  // Create React root on the DOM element
  const root = createRoot(block);
  
  // Render React component into the DOM element
  root.render(<App />);
}
```

**What happens**:
1. `createRoot(block)` creates a React root attached to the DOM `block` element
2. `root.render(<App />)` renders the React component into that DOM element
3. React takes over that DOM node and manages it

#### Step 7: React Takes Over

Once rendered:
- React manages the component's lifecycle
- State changes trigger re-renders
- The component can use hooks, context, etc.
- The DOM element is now controlled by React

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT PHASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  react-app/app/banner/                                       │
│  ├── index.jsx (decorateBlock function)                     │
│  ├── components/app.jsx (React Component)                   │
│  └── styles/index.css                                       │
│           │                                                  │
│           ▼                                                  │
│  Webpack Build Process                                       │
│  ├── Babel transforms JSX → JS                              │
│  ├── CSS extraction                                          │
│  ├── Code splitting (vendor + component chunks)              │
│  └── Output: ES modules                                      │
│           │                                                  │
│           ▼                                                  │
│  dist/default/banner/                                        │
│  ├── banner.js (ES module)                                  │
│  └── banner.css                                             │
│           │                                                  │
│           ▼                                                  │
│  CopyFiles Plugin                                            │
│           │                                                  │
│           ▼                                                  │
│  blocks/banner/                                              │
│  ├── banner.js                                              │
│  └── banner.css                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     RUNTIME PHASE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HTML Page Loads                                             │
│  <div class="banner">...</div>                              │
│           │                                                  │
│           ▼                                                  │
│  scripts.js → loadEager() → decorateBlocks()                 │
│           │                                                  │
│           ▼                                                  │
│  scripts/aem.js → loadBlock(block)                          │
│  ├── Load CSS: blocks/banner/banner.css                     │
│  └── Dynamic Import: blocks/banner/banner.js                │
│           │                                                  │
│           ▼                                                  │
│  Execute: mod.default(block)                                 │
│  (calls decorateBlock from banner.js)                       │
│           │                                                  │
│           ▼                                                  │
│  React Rendering                                             │
│  ├── createRoot(block) → React root                         │
│  └── root.render(<App />) → Component renders               │
│           │                                                  │
│           ▼                                                  │
│  React Component Active                                      │
│  └── DOM element now managed by React                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Integration Points

### 1. **ES Module System**
- React components are built as ES modules (`library.type: 'module'`)
- Allows dynamic `import()` in the browser
- Enables code splitting and lazy loading

### 2. **Block-Based Architecture**
- React components integrate with AEM's block system
- Each block can be a React component or traditional JS
- Blocks are loaded on-demand (lazy loading)

### 3. **Vendor Chunk Separation**
- React/ReactDOM are in a separate `vendor.js` file
- Loaded once and shared across all React components
- Reduces bundle size for individual components

### 4. **CSS Extraction**
- Component CSS is extracted to separate files
- Loaded alongside the JS module
- Supports CSS modules and regular CSS

---

## Development Workflow

### **Local Development**
```bash
npm run react:start
```
- Starts webpack-dev-server on `localhost:4200`
- Watches `react-app/**/*` for changes
- Hot reloading (though `hot: false` in config)
- Writes files to disk (`writeToDisk: true`)

### **Production Build**
```bash
npm run react:build
```
- Minifies JS and CSS
- Removes console logs
- Optimizes bundles
- Copies files to `blocks/` directory

---

## File Flow Summary

1. **Source**: `react-app/app/{block}/index.jsx` (React component)
2. **Build**: Webpack transforms and bundles → `dist/default/{block}/{block}.js`
3. **Copy**: Files copied to `blocks/{block}/` for AEM integration
4. **Runtime**: HTML loads → `loadBlock()` → Dynamic import → React renders

---

## Benefits of This Architecture

1. **Progressive Enhancement**: React components work alongside traditional blocks
2. **Code Splitting**: Each component loads independently
3. **Lazy Loading**: Components load only when needed
4. **AEM Integration**: Seamless integration with existing AEM block system
5. **Developer Experience**: Modern React development with JSX, hooks, etc.
6. **Performance**: Vendor chunk shared, CSS extracted, optimized bundles

---

## Example: Banner Block Flow

1. **Developer writes**: `react-app/app/banner/components/app.jsx`
2. **Webpack builds**: `dist/default/banner/banner.js` + `banner.css`
3. **Files copied**: `blocks/banner/banner.js` + `banner.css`
4. **Page loads**: HTML contains `<div class="banner">`
5. **Script loads**: `loadBlock()` called with banner element
6. **Module imports**: `import('./blocks/banner/banner.js')`
7. **React renders**: `decorateBlock()` creates root and renders `<App />`
8. **Component active**: React manages the banner DOM element

---

## Notes

- React 18's `createRoot` API is used (not the legacy `ReactDOM.render`)
- Components are ES modules, enabling dynamic imports
- The system supports multiple brands (though only 'default' is active)
- CSS is extracted separately for better caching
- Vendor code is separated for optimal caching across components
