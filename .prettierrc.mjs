// Configuración de Prettier — define CÓMO se formatea el código (espacios, comillas, etc.).
// Prettier solo da formato; las reglas de calidad de código viven en ESLint.
const config = {
	// Termina cada sentencia con punto y coma ( ; ).
	semi: true,
	// Usa tabulaciones (en vez de espacios) para la indentación.
	useTabs: true,
	// Ancho visual de cada tabulación = 2 columnas (afecta cómo se ve, no el carácter).
	tabWidth: 2,
	// Usa comillas simples ( ' ) para los strings de JS/TS.
	// (En atributos JSX Prettier sigue usando dobles automáticamente, según el estándar.)
	singleQuote: true,
	// Agrega coma final en listas/objetos multilínea (mejora los diffs de git).
	trailingComma: "all",
	// Corta la línea cuando supera los 100 caracteres.
	printWidth: 100,
	// Pone espacios dentro de las llaves: { foo } en lugar de {foo}.
	bracketSpacing: true,
	// Elimina los paréntesis cuando la función flecha tiene un solo argumento: x => x.
	arrowParens: "avoid",
	// Normaliza los saltos de línea a estilo LF (Unix), evita conflictos entre SO.
	endOfLine: "lf",
};

// Exporta la configuración para que Prettier (y ESLint) la lean.
export default config;
