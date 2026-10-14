/**
 * Ajustes de automatizacion que se cambian desde el panel.
 *
 * Viven en base de datos y no en variables de entorno porque quien los
 * cambia es el equipo de soporte, no quien despliega.
 */
export interface AutomationSettings {
  /**
   * La IA contesta sola los WhatsApp entrantes mientras pueda resolver la
   * consulta; si no puede, crea el ticket y se retira de la conversacion.
   */
  whatsappAutoReply: boolean;
}

export type UpdateAutomationSettingsInput = Partial<AutomationSettings>;
