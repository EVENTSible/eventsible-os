for(const f of['gigtracker-v1-ops-entry.js','event-workspace-core.js','event-workspace-render.js','event-workspace-actions.js'])await import(new URL('./'+f,import.meta.url).href);
