# OVPL Screen Print Calculator v5
### Con precios live de SS&A Activewear

---

## ¿Qué hace esto?
- Calculadora de precios para serigrafía textil (Kenner, LA)
- Se conecta a tu cuenta de SS&A Activewear para mostrar **tus precios reales wholesale** en tiempo real
- Tu API key vive solo en Vercel (nunca visible en el navegador)

---

## Despliegue en 5 pasos

### Paso 1 — Sube este repositorio a GitHub
Si ya tienes GitHub, crea un repo nuevo (puede ser privado) y sube todos estos archivos.

```bash
git init
git add .
git commit -m "OVPL Calculator v5"
git remote add origin https://github.com/TU_USUARIO/ovpl-calculator.git
git push -u origin main
```

### Paso 2 — Crea cuenta en Vercel (gratis)
Ve a **https://vercel.com** → Sign up with GitHub → autoriza el acceso.

### Paso 3 — Importa tu repositorio en Vercel
1. En Vercel: **Add New Project**
2. Selecciona el repo `ovpl-calculator`
3. Framework Preset: **Other** (no Next.js, no Create React App)
4. Root Directory: dejar en `/` (raíz)
5. Haz click en **Deploy** — Vercel detecta el `vercel.json` automáticamente

### Paso 4 — Agrega tus credenciales de SS&A como variables de entorno
1. En Vercel, abre tu proyecto → **Settings** → **Environment Variables**
2. Agrega estas dos variables:

| Name | Value |
|------|-------|
| `SSA_ACCOUNT` | Tu número de cuenta SS&A (ej: `123456`) |
| `SSA_API_KEY` | Tu API key de SS&A |

3. Haz click en **Save**
4. Ve a **Deployments** → haz click en los tres puntos del último deploy → **Redeploy**

### Paso 5 — Abre tu calculadora
Vercel te da una URL como `https://ovpl-calculator-xxxx.vercel.app`

La calculadora se conecta automáticamente a SS&A al abrir la página. 
Busca cualquier estilo (ej: "Gildan 5000") y los precios de tu cuenta wholesale cargan solos.

---

## Estructura del proyecto

```
ovpl-calculator/
├── api/
│   ├── ssa-styles.js      ← Busca estilos en SS&A
│   ├── ssa-products.js    ← Carga precios por styleID
│   └── ssa-inventory.js   ← Verifica inventario (futuro)
├── public/
│   └── index.html         ← La calculadora completa
├── vercel.json            ← Configuración Vercel
├── package.json
└── README.md
```

---

## ¿Cómo actualizar la calculadora?
Solo edita `public/index.html`, haz commit y push a GitHub.
Vercel redespliega automáticamente en ~30 segundos.

---

## Preguntas frecuentes

**¿Mi API key es segura?**
Sí. Las variables de entorno en Vercel solo son accesibles desde las serverless functions (los archivos en `/api/`). El navegador nunca las ve.

**¿Cada cuánto se actualizan los precios de SS&A?**
SS&A actualiza precios a diario y el inventario cada 15 minutos. Cada vez que buscas un producto en la calculadora, haces una llamada fresca a su API.

**¿Tiene costo?**
El plan gratuito de Vercel permite 100,000 function invocations/mes, que es más que suficiente para una calculadora de uso personal.

---

## Soporte
OVPL — Kenner, Louisiana
