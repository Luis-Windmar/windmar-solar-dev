# Zoho CRM — Commercial_Lead Field Map
## API Field Name ↔ UI Label
### Source: Live API read, session 2026-03-19
### Record used: 4258103003144630371

All fields returned by `GET /crm/v3/Commercial_Lead/{id}`.
Fields marked ✅ are currently mapped in the PreQual integration.
Fields marked 🔲 are candidates for future mapping.
Fields marked ⚙️ are system/auto fields — do not send in POST.

---

## Contact & Business Info

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Primary_Contact` | Contacto Principal | String | ✅ Mapped | Customer full name |
| `Account_Name` | Nombre del Negocio | String | ✅ Mapped | Business name |
| `Phone_2` | Teléfono Principal | String | ✅ Mapped | Main phone |
| `Phone_3` | Teléfono Secundario | String | ✅ Mapped | Secondary phone |
| `Phone_5` | Teléfono 5 | String | 🔲 Candidate | Unknown use |
| `Email` | Email | String | ✅ Mapped | Primary email |
| `Email_1` | Email 1 | String | 🔲 Candidate | Secondary email |
| `Email_2` | Email 2 | String | 🔲 Candidate | Tertiary email |
| `Secondary_Contact` | Contacto Secundario | String | 🔲 Candidate | Second contact person |
| `Address` | Dirección | String | ✅ Mapped | Street address |
| `City` | Ciudad / Municipio | String | ✅ Mapped | Municipality |
| `Zip_Code` | Código Postal | String | ✅ Mapped | Note: NOT `Zip` |
| `Latitude` | Latitud | Number | 🔲 Candidate | GPS coordinates |
| `Longitude` | Longitud | Number | 🔲 Candidate | GPS coordinates |
| `Google_Maps_Link` | Enlace Google Maps | String | 🔲 Candidate | Map link to property |
| `Catastro` | Catastro | String | 🔲 Candidate | PR cadastral number |

---

## Lead Management

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Lead_Status` | Estado del Lead | Picklist | ✅ Mapped | Set to "New Lead" |
| `Lead_Source` | Fuente del Lead | Picklist | ✅ Mapped | Set to "PreQual Wizard" |
| `Lead_Notes` | Notas del Lead | String | ✅ Mapped | Free text / OCR summary |
| `Lead_Number` | Número de Lead | String | 🔲 Candidate | e.g. "C20000" from notes string |
| `Lead_Owner` | Dueño del Lead | Lookup | ⚙️ System | Auto-assigned |
| `Owner` | Propietario | Lookup | ✅ Mapped | Set via ZOHO_OWNER_USER_ID |
| `Sales_Rep` | Representante de Ventas | Lookup | 🔲 Candidate | CRM user lookup |
| `Sales_Rep_Email` | Email del Representante | String | ✅ Mapped | Rep using the tablet |
| `Sales_Rep_Phone` | Teléfono del Representante | String | 🔲 Candidate | Rep's phone |
| `Nombre_de_quien_refiere` | Nombre de quien Refiere | String | 🔲 Candidate | Referral name |
| `Priority` | Prioridad | Picklist | 🔲 Candidate | Lead priority |
| `Tag` | Etiquetas | Multi-select | 🔲 Candidate | Tags |
| `Com_Lead_Name` | Nombre Lead Comercial | String | ⚙️ System | Auto-generated, e.g. "CL1059 API TEST IGNORE ME" |
| `Name` | Número de Registro | String | ⚙️ System | Auto-generated, e.g. "CL1059" |
| `Notas_de_Seguimiento` | Notas de Seguimiento | String | 🔲 Candidate | Follow-up notes |
| `Notas` | Notas | String | 🔲 Candidate | General notes |
| `Intentos_de_llamadas` | Intentos de Llamadas | Number | 🔲 Candidate | Call attempts |
| `Intento_de_llamadas` | Intento de Llamadas | Number | 🔲 Candidate | Possible duplicate of above |
| `Ultima_llamada` | Última Llamada | DateTime | 🔲 Candidate | Last call timestamp |
| `Ultimo_Contacto` | Último Contacto | DateTime | 🔲 Candidate | Last contact timestamp |
| `Ultima_Comunicacion_por_Teams` | Última Comunicación por Teams | DateTime | 🔲 Candidate | Last Teams message |
| `Comunicacion_por_Teams` | Comunicación por Teams | Boolean | 🔲 Candidate | Teams contact flag |
| `Seguimiento_Programado` | Seguimiento Programado | DateTime | 🔲 Candidate | Scheduled follow-up |
| `Seguimiento_Cliente_Programado` | Seguimiento Cliente Programado | DateTime | 🔲 Candidate | Customer follow-up scheduled |
| `Closing_Probability` | Probabilidad de Cierre | Number | 🔲 Candidate | % closing probability |
| `Cancellation_Reason` | Razón de Cancelación | Picklist | 🔲 Candidate | Why cancelled |
| `Cancelled` | Cancelado | Boolean/DateTime | 🔲 Candidate | Cancellation flag |

---

## Solar System & Technical

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Consumo_Promedio` | Consumo Promedio | Number | ✅ Mapped | Monthly avg kWh from bill |
| `Consumo_Ultimos_12_Meses` | Consumo Últimos 12 Meses | Number | 🔲 Candidate | 12-month total kWh |
| `Carga_Contratada_KVA` | Carga Contratada | Number | ✅ Mapped | Demand in kVA from bill |
| `Tama_o_Estimado` | Tamaño Estimado (p²) | Number | ✅ Mapped | Roof size in sq ft |
| `PV_System_Size_kW1` | Tamaño Sistema PV (kW) | String | ✅ Mapped | Estimated system size kWp |
| `PV_System_Size_kW` | Tamaño Sistema PV (kW) alt | String | 🔲 Candidate | Possible alternate field — null in test |
| `System_Size_DC` | Tamaño Sistema DC | Number | 🔲 Candidate | DC system size |
| `System_Size_AC` | Tamaño Sistema AC | Number | 🔲 Candidate | AC system size |
| `System_Size_Calculation` | Cálculo Tamaño Sistema | String | 🔲 Candidate | Calculation notes |
| `Size_Process` | Proceso de Tamaño | Picklist | 🔲 Candidate | Sizing process status |
| `Tipo_de_Tarifa` | Tipo de Tarifa | Picklist | 🔲 Candidate | LUMA tariff type |
| `Voltaje_de_la_Red` | Voltaje de la Red | Picklist | 🔲 Candidate | Grid voltage |
| `Voltaje_Transformador` | Voltaje del Transformador | Picklist | 🔲 Candidate | Transformer voltage |
| `Capacidad_Transformador` | Capacidad del Transformador | Number | 🔲 Candidate | Transformer capacity |
| `Tama_o_del_Transformador_KVA` | Tamaño del Transformador (KVA) | Number | 🔲 Candidate | Transformer size in KVA |
| `DG_Penetration` | Penetración DG | Number | 🔲 Candidate | Distributed generation % |
| `Main_Breaker` | Breaker Principal | String | 🔲 Candidate | Main breaker size |
| `Multiples_Contadores` | Múltiples Contadores | Boolean | 🔲 Candidate | Multiple meters flag |
| `Estudio_de_Carga` | Estudio de Carga | Boolean | 🔲 Candidate | Load study required |

---

## Equipment & Configuration

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Panel` | Panel Solar | Picklist/Lookup | 🔲 Candidate | Panel model |
| `Panel_Qty` | Cantidad de Paneles | Number | 🔲 Candidate | Number of panels |
| `Inversores` | Inversores | Picklist/Lookup | 🔲 Candidate | Inverter model |
| `Inverter` | Inversor | Picklist/Lookup | 🔲 Candidate | Inverter selection |
| `Inverter_QTY` | Cantidad de Inversores | Number | 🔲 Candidate | Number of inverters |
| `Inverter_Add` | Inversor Adicional | Picklist | 🔲 Candidate | Additional inverter |
| `Inverter_Add_Qty` | Cantidad Inversores Adicionales | Number | 🔲 Candidate | Additional inverter qty |
| `Racking` | Racking | Picklist | 🔲 Candidate | Racking system type |
| `Baterias` | Baterías | Boolean | 🔲 Candidate | Battery included flag |
| `Battery_Type` | Tipo de Batería | Picklist | 🔲 Candidate | Battery type |
| `Baterry_Type` | Tipo de Batería (alt) | Picklist | 🔲 Candidate | Possible typo duplicate of above |
| `Battery_Qty` | Cantidad de Baterías | Number | 🔲 Candidate | Number of batteries |
| `Battery_System_Size_kWh` | Tamaño Sistema Batería (kWh) | Number | 🔲 Candidate | Battery system size |
| `Storage_Size_kWh` | Tamaño Almacenamiento (kWh) | Number | 🔲 Candidate | Storage capacity |
| `Tipo_de_Respaldo` | Tipo de Respaldo | Picklist | 🔲 Candidate | Backup type |
| `Existing_Battery_Type` | Tipo Batería Existente | Picklist | 🔲 Candidate | Existing battery if any |
| `Existing_System_Notes` | Notas Sistema Existente | String | 🔲 Candidate | Notes on existing system |
| `Existing_System_Docs` | Docs Sistema Existente | File | 🔲 Candidate | Existing system documents |
| `Transfer_Switch` | Transfer Switch | Boolean | 🔲 Candidate | Transfer switch required |
| `Tuberias` | Tuberías | Boolean | 🔲 Candidate | Conduit/piping |
| `Zanja_Excavacion` | Zanja / Excavación | Boolean | 🔲 Candidate | Trenching required |
| `BOS_Electrico` | BOS Eléctrico | String | 🔲 Candidate | Electrical BOS notes |
| `Configuracion_del_Sistema` | Configuración del Sistema | Multi-select | 🔲 Candidate | System configuration options |
| `Tipo_Conexion` | Tipo de Conexión | Picklist | 🔲 Candidate | Grid connection type |
| `Metodo_de_Envio` | Método de Envío | Multi-select | 🔲 Candidate | Delivery method |

---

## Roof & Site

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Techo_Estable` | Techo Estable | Boolean | 🔲 Candidate | Roof structurally sound |
| `Revision_Techo` | Revisión de Techo | Boolean | 🔲 Candidate | Roof inspection required |
| `Carport` | Carport | Boolean | 🔲 Candidate | Carport mount |
| `Canopy` | Canopy | Boolean | 🔲 Candidate | Canopy mount |
| `Groundmount` | Groundmount | Boolean | 🔲 Candidate | Ground mount |
| `Ballasted` | Ballasted | Boolean | 🔲 Candidate | Ballasted mount |
| `Transformador` | Transformador | Boolean | 🔲 Candidate | Transformer on site |
| `MDP_Location` | Ubicación MDP | String | 🔲 Candidate | Main distribution panel location |

---

## Pricing & Financials

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `EPC_BASE` | EPC Base | Number | 🔲 Candidate | Base EPC cost |
| `Sum_of_Adders` | Suma de Adders | Number | 🔲 Candidate | Total adder costs |
| `Notas_Adders` | Notas Adders | String | 🔲 Candidate | Adder notes |
| `Quote_Amount` | Monto de Cotización | Number | 🔲 Candidate | Final quote amount |
| `Finance_Options` | Opciones de Financiamiento | Multi-select | 🔲 Candidate | Financing options |
| `Incentive_Options` | Opciones de Incentivos | String | 🔲 Candidate | Available incentives |
| `Alquiler_de_Equipos` | Alquiler de Equipos | Boolean | 🔲 Candidate | Equipment lease flag |
| `Bundle_Deal` | Bundle Deal | Boolean | 🔲 Candidate | Bundled deal flag |
| `Promo_Item` | Artículo Promocional | String | 🔲 Candidate | Promo item included |
| `Currency` | Moneda | String | ⚙️ System | Always "USD" |
| `Exchange_Rate` | Tasa de Cambio | Number | ⚙️ System | Always 1 for USD |

---

## Sales Process & Appointments

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Cita` | Cita | DateTime | 🔲 Candidate | Appointment datetime |
| `Cita_Type` | Tipo de Cita | Picklist | 🔲 Candidate | Appointment type |
| `Cita_Orientacion` | Cita de Orientación | DateTime | 🔲 Candidate | Orientation appointment |
| `Cita_se_dio` | Cita se Dio | Boolean | 🔲 Candidate | Appointment kept flag |
| `Cita_se_dio1` | Cita se Dio (alt) | Boolean | 🔲 Candidate | Possible duplicate |
| `Cita_Coordinada_por_Vendedor` | Cita Coordinada por Vendedor | Boolean | 🔲 Candidate | Rep-scheduled appointment |
| `Reschedule_Reason` | Razón de Reprogramación | Picklist | 🔲 Candidate | Why rescheduled |
| `Reschedule_Survey` | Reprogramar Visita | Boolean | 🔲 Candidate | Survey rescheduled flag |
| `Veces_Recoordinado` | Veces Recoordinado | Number | 🔲 Candidate | Times rescheduled |
| `Presentacion_al_Cliente` | Presentación al Cliente | Boolean | 🔲 Candidate | Presentation given flag |
| `Presentacion_se_dio` | Presentación se Dio | Boolean | 🔲 Candidate | Presentation completed |
| `Caso_Vendido_Solar` | Caso Vendido Solar | Boolean | 🔲 Candidate | Solar case sold |
| `Assisted_Closing` | Cierre Asistido | String | 🔲 Candidate | Assisted closing notes |
| `Asistencia_al_Consultor` | Asistencia al Consultor | String | 🔲 Candidate | Consultant assistance |
| `Asistencia_con_el_Cliente` | Asistencia con el Cliente | String | 🔲 Candidate | Customer assistance |
| `Lead_Assistance` | Asistencia al Lead | String | 🔲 Candidate | Lead assistance notes |
| `Underwritting_Agent_Consierge` | Agente de Underwriting | Lookup | 🔲 Candidate | UW agent assigned |
| `Underwritting_Notes` | Notas de Underwriting | String | 🔲 Candidate | UW notes |
| `Underwritting_Docs` | Docs de Underwriting | File list | 🔲 Candidate | UW documents |

---

## Site Survey

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `Site_Survey_Type_Pre_Cierre` | Tipo de Visita Pre-Cierre | Picklist | 🔲 Candidate | Survey type |
| `Site_Survey_Date_and_Time` | Fecha y Hora de Visita | DateTime | 🔲 Candidate | Survey scheduled datetime |
| `Site_Survey_Start_Time_Block` | Bloque de Hora Inicio | Picklist | 🔲 Candidate | Time block |
| `Site_Survey_Notes` | Notas de Visita | String | 🔲 Candidate | Survey notes |
| `Site_Survey_Completed` | Visita Completada | Boolean | 🔲 Candidate | Survey done flag |
| `Surveyor` | Agrimensor / Inspector | Lookup | 🔲 Candidate | Assigned surveyor |
| `Ready_for_Site_Survey` | Listo para Visita | Boolean | 🔲 Candidate | Ready for survey flag |
| `Revision_Confirmada` | Revisión Confirmada | Boolean | 🔲 Candidate | Review confirmed |
| `Numero_de_Revisiones` | Número de Revisiones | Number | 🔲 Candidate | Number of reviews |
| `Ultima_Revison` | Última Revisión | DateTime | 🔲 Candidate | Last review timestamp |
| `Preliminary_Design_Notes` | Notas de Diseño Preliminar | String | 🔲 Candidate | Preliminary design notes |
| `Preliminary_Reviewer_Notes` | Notas del Revisor Preliminar | String | 🔲 Candidate | Reviewer notes |
| `Plano_Preliminar_Ready` | Plano Preliminar Listo | Boolean | 🔲 Candidate | Preliminary plan ready |

---

## Contract & Closing

| API Field | UI Label (best guess) | Type | Status | Notes |
|---|---|---|---|---|
| `LOI_Signed` | LOI Firmado | Boolean/DateTime | 🔲 Candidate | Letter of intent signed |
| `Contract_Sent` | Contrato Enviado | Boolean/DateTime | 🔲 Candidate | Contract sent flag |
| `Contract_Signed` | Contrato Firmado | Boolean/DateTime | 🔲 Candidate | Contract signed flag |
| `Permisos` | Permisos | Boolean | 🔲 Candidate | Permits flag |
| `Quoting_Package_Status` | Estado del Paquete de Cotización | Picklist | 🔲 Candidate | Quote package status |
| `Quoting_Package_Sent` | Paquete de Cotización Enviado | Boolean/DateTime | 🔲 Candidate | Quote package sent |
| `Envio_Copia_Clinete` | Envío Copia al Cliente | Boolean | 🔲 Candidate | Copy sent to customer |
| `Cuestionario_Submitted` | Cuestionario Enviado | Boolean/DateTime | 🔲 Candidate | Deal questionnaire submitted |
| `Logistica` | Logística | String | 🔲 Candidate | Logistics notes |

---

## System Fields (auto-set by Zoho — do not send in POST)

| API Field | Description |
|---|---|
| `id` | Record ID — returned on create |
| `Name` | Auto record number, e.g. "CL1059" |
| `Com_Lead_Name` | Auto display name, e.g. "CL1059 Panaderia Test" |
| `Created_Time` | Creation timestamp |
| `Modified_Time` | Last modified timestamp |
| `Created_By` | User who created the record (API user) |
| `Modified_By` | User who last modified |
| `Last_Activity_Time` | Last activity timestamp |
| `$state` | Internal state |
| `$process_flow` | Process flow flag |
| `$orchestration` | Orchestration flag |
| `$approval` | Approval state object |
| `$review_process` | Review process state |
| `$approval_state` | Approval state string |
| `$editable` | Whether current user can edit |
| `$locked_for_me` | Lock state |
| `$in_merge` | Merge state |
| `$field_states` | Field states |
| `$sharing_permission` | Sharing permission level |
| `$layout_id` | Layout assigned to record |
| `$pathfinder` | Pathfinder flag |
| `$zia_owner_assignment` | Zia AI owner suggestion |
| `$zia_visions` | Zia AI visions |
| `$wizard_connection_path` | Wizard connection |
| `$review` | Review state |
| `$currency_symbol` | Currency symbol |
| `Locked__s` | Lock flag |
| `Unsubscribed_Mode` | Unsubscribe mode |
| `Unsubscribed_Time` | Unsubscribe timestamp |
| `Exchange_Rate` | Always 1 for USD |
| `Currency` | Always "USD" |
| `Products` | Related products list |
| `Tag` | Tags list |

---

## Notes

- Field names are case-sensitive in API calls
- `Baterry_Type` appears to be a typo of `Battery_Type` — both exist in the schema
- `Intento_de_llamadas` and `Intentos_de_llamadas` may be duplicates — use `Intentos_de_llamadas`
- `PV_System_Size_kW` (null in test) vs `PV_System_Size_kW1` (confirmed working) — always use `PV_System_Size_kW1`
- Boolean fields default to `false` when not sent — no need to explicitly set them to null
- File/attachment fields (`Existing_System_Docs`, `Underwritting_Docs`) are lists — attachments are added via the `/Attachments` endpoint, not directly in the record POST
