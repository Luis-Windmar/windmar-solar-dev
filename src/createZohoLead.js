const parsed = parseLeadNotes(leadData.notes);

// In the data payload:
Consumo_Promedio:      parsed.consumo   ? parseFloat(parsed.consumo)   : (leadData.avgConsumption || null),
Carga_Contratada_KVA:  parsed.demanda   ? parseFloat(parsed.demanda)   : null,
PV_System_Size_kW1:    parsed.sistema   || (leadData.systemSizeKw ? String(leadData.systemSizeKw) : null),
Tama_o_Estimado:       parsed.techo     ? parseFloat(parsed.techo)     : (leadData.roofSizeEstimate || null),
Lead_Number:           parsed.cotizacion || null,
Lead_Notes:            [parsed.tarifa, parsed.cobertura, parsed.precio]
                         .filter(Boolean)
                         .join(' | ') || leadData.notes || null,
