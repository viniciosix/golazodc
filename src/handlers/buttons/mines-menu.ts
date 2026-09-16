import type { Button } from '../../core/types.js';
import { handleMinesMenu } from '../../modules/mines/menu-handler.js';
export default { id: 'mines-menu', execute: handleMinesMenu } satisfies Button;
