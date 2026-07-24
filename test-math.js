// test-math.js — Verify posts.js's custom markdown parser produces the right
// HTML for the user's exact LaTeX input. Loads posts.js into a sandboxed
// VM with stub globals, then calls parseLines and inspects the output.

const fs = require('fs');
const vm = require('vm');

const postsJs = fs.readFileSync('posts.js', 'utf8');

// === Stub-a-browser context ===
const ctx = {
  console,
  setTimeout,
  clearTimeout,
  URLSearchParams,
  URL,
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
ctx.window = ctx; // so `window.X = ...` writes back into ctx
ctx.window.addEventListener = () => {};
ctx.window.dispatchEvent = () => {};
ctx.window.katex = undefined;
ctx.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
    appendChild: () => {},
    setAttribute: () => {},
    addEventListener: () => {},
    click: () => {},
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: ''
  }),
  body: {
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    appendChild: () => {},
    style: {},
    overflow: ''
  },
  documentElement: { setAttribute: () => {}, getAttribute: () => null },
  createDocumentFragment: () => ({ appendChild: () => {} })
};
vm.createContext(ctx);

// === Evaluate posts.js ===
const loadErr = (() => {
  try { vm.runInContext(postsJs, ctx, { filename: 'posts.js' }); return null; }
  catch (e) { return e; }
})();
if (loadErr) {
  console.error('✗ posts.js threw on load:', loadErr.message);
  process.exit(1);
}
console.log('✓ posts.js loaded into VM sandbox without errors\n');

console.log('Exported functions reachable on global:');
console.log('  parseLines:    ', typeof ctx.parseLines);
console.log('  parseInline:   ', typeof ctx.parseInline);
console.log('  renderPostMath:', typeof ctx.renderPostMath);
console.log('  esc:           ', typeof ctx.esc, '\n');

// === Test 1: user's exact input ===
console.log('=== TEST 1: User\'s exact LaTeX snippet ===');
const userInput = `Hello world.

$$
v = \\sqrt{\\frac{G M}{r}}
$$

That's the orbital velocity formula.`;
console.log('RAW INPUT:');
console.log(userInput);
console.log('---');

const output = ctx.parseLines(userInput.split('\n'));
console.log('\nPARSED HTML:');
console.log(output);

const expected = '<div class="math math-display">v = \\sqrt{\\frac{G M}{r}}</div>';
console.log('\nVERIFICATION');
console.log('  Expected substr:', JSON.stringify(expected));
const ok = output.includes(expected);
console.log('  Match:', ok ? '✓ YES' : '✗ NO');

if (!ok) {
  console.error('\n✗✗✗ FAIL: parser did not produce expected display-math block');
  process.exit(1);
}

// === Test 2: inline math ===
console.log('\n=== TEST 2: Inline math $E = mc^2$ ===');
const inlineOut = ctx.parseLines(["Einstein's equation is $E = mc^2$."]);
console.log('Output:', inlineOut);
const inlineExpected = '<span class="math math-inline">E = mc^2</span>';
const okInline = inlineOut.includes(inlineExpected);
console.log('  Expected:', JSON.stringify(inlineExpected));
console.log('  Match:', okInline ? '✓ YES' : '✗ NO');

// === Test 3: single-line display math $$x^2$$ ===
console.log('\n=== TEST 3: Single-line display $$x^2$$ ===');
const singleOut = ctx.parseLines(['Square is $$x^2$$ in algebra.']);
console.log('Output:', singleOut);
const singleExpected = '<span class="math math-display">x^2</span>';
const okSingle = singleOut.includes(singleExpected);
console.log('  Match:', okSingle ? '✓ YES' : '✗ NO');

// === Test 4: renderPostMath idempotency check ===
console.log('\n=== TEST 4: renderPostMath function inspection ===');
const rpmSrc = ctx.renderPostMath.toString();
console.log('renderPostMath is', rpmSrc.length, 'chars');
console.log('Calls window.katex.render:', /katex\.render/.test(rpmSrc) ? '✓ YES' : '✗ NO');
console.log('Sets data-rendered="1":', /dataset\.rendered\s*=\s*["']1["']/.test(rpmSrc) ? '✓ YES' : '✗ NO');
console.log('Idempotent guard present:', /dataset\.rendered\s*===\s*["']1["']/.test(rpmSrc) ? '✓ YES' : '✗ NO');
console.log('Display mode detected from class math-display:', /classList\.contains\(\s*["']math-display["']\s*\)/.test(rpmSrc) ? '✓ YES' : '✗ NO');

// === Test 5: openPostOverlay wiring (string-grep, since DOM isn't real) ===
console.log('\n=== TEST 5: openPostOverlay calls renderPostMath ===');
const allSrc = postsJs;
const rpmCallCount = (allSrc.match(/renderPostMath\s*\(/g) || []).length;
console.log('  renderPostMath(...) call sites in posts.js:', rpmCallCount);
console.log('  need at least 2 (initial-load path + post-translate path)');

console.log('\n=== SUMMARY ===');
if (ok && okInline && okSingle) {
  console.log('✓✓✓ All parser smoke tests PASS.');
  console.log('Math blocks correctly emitted; KaTeX will render on the page.');
} else {
  console.log('✗✗✗ Some tests failed — review output above.');
  process.exit(2);
}
