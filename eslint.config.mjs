// Importa los ayudantes de ESLint para definir e ignorar configuraciones (flat config de ESLint 9).
import { defineConfig, globalIgnores } from 'eslint/config';
// Reglas recomendadas de Next.js para rendimiento y buenas prácticas (Core Web Vitals).
import nextVitals from 'eslint-config-next/core-web-vitals';
// Reglas de Next.js específicas para TypeScript.
import nextTs from 'eslint-config-next/typescript';
// Plugin que ejecuta Prettier DENTRO de ESLint y marca el mal formato como error.
import prettierPlugin from 'eslint-plugin-prettier';
// Config que APAGA las reglas de ESLint que chocan con Prettier (evita conflictos de formato).
import prettierConfig from 'eslint-config-prettier';

// Define la configuración de ESLint como un arreglo de bloques que se aplican en orden.
const eslintConfig = defineConfig([
	// 1) Aplica las reglas base de Next.js (Web Vitals + TypeScript).
	...nextVitals,
	...nextTs,

	// 2) Bloque con nuestras reglas personalizadas de calidad de código.
	{
		// Aplica estas reglas a todos los archivos JS/TS/JSX/TSX.
		files: ['**/*.{js,mjs,ts,jsx,tsx}'],
		// Registra el plugin de Prettier con el nombre "prettier".
		plugins: { prettier: prettierPlugin },
		rules: {
			// Reporta como ERROR cualquier código que no respete el formato de .prettierrc.mjs.
			'prettier/prettier': 'error',
			// Exige punto y coma ( ; ) al final de cada sentencia.
			semi: ['error', 'always'],
			// Prohíbe puntos y coma innecesarios (dobles o sueltos).
			'no-extra-semi': 'error',
			// Obliga a usar funciones flecha en los callbacks (ej: array.map(x => ...)).
			'prefer-arrow-callback': 'error',
			// Obliga a declarar funciones como expresiones flecha (const f = () => {}), no como function f(){}.
			'func-style': ['error', 'expression', { allowArrowFunctions: true }],
			// Quita las llaves de la flecha cuando el cuerpo es un solo return (x => x * 2).
			'arrow-body-style': ['error', 'as-needed'],
			// Prefiere const/let sobre var, y const si la variable no se reasigna.
			'no-var': 'error',
			'prefer-const': 'error',
		},
	},

	// 3) Debe ir AL FINAL: desactiva reglas de formato de ESLint que pelean con Prettier.
	prettierConfig,

	// 4) Carpetas y archivos que ESLint debe ignorar.
	globalIgnores(['.next/**', 'out/**', 'build/**', 'generated/**', 'next-env.d.ts']),
]);

// Exporta la configuración para que ESLint la use al correr `yarn lint`.
export default eslintConfig;
