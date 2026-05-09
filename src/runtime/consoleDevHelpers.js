/**
 * Только для отладки в консоли браузера: не использовать в игровой логике.
 * После загрузки: window.MousefallDev.addItemById("…"), listItemIds().
 */

/**
 * @param {{
 *   getState: () => object,
 *   render: () => void,
 *   getItemById: (id: string) => object | null,
 *   getAllLootItems: () => object[],
 *   createRuntimeItemInstance: Function,
 *   recalculateSheetFromInventory: Function,
 * }} api
 */
export function installMousefallConsoleHelpers(api) {
  const {
    getState,
    render,
    getItemById,
    getAllLootItems,
    createRuntimeItemInstance,
    recalculateSheetFromInventory,
  } = api;

  window.MousefallDev = {
    /**
     * Добавляет один экземпляр предмета в сумку текущего playerSheet.
     * @returns {boolean} удалось ли добавить
     */
    addItemById(itemId) {
      const id = String(itemId || "").trim();
      const item = id ? getItemById(id) : null;
      if (!item) {
        console.warn("[Mousefall] неизвестный id предмета:", itemId);
        return false;
      }
      const sheet = getState()?.playerSheet;
      if (!sheet) {
        console.warn("[Mousefall] нет playerSheet (запустите забег или проверьте состояние).");
        return false;
      }
      const created = createRuntimeItemInstance(sheet, item.id);
      const nextBag = [...(sheet.bag || [])];
      nextBag.push({ instanceId: created.instanceId, itemId: item.id });
      const nextSheet = recalculateSheetFromInventory(
        { ...sheet, itemInstances: created.itemInstances },
        sheet.equippedByType || {},
        nextBag,
        sheet.equippedInstanceByType || {},
      );
      getState().playerSheet = nextSheet;
      console.log(`[Mousefall] в сумку: ${item.id} (${item.name})`);
      render();
      return true;
    },

    /**
     * Выводит в консоль таблицу всех предметов каталога и возвращает массив id.
     */
    listItemIds() {
      const items = [...getAllLootItems()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const rows = items.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        категория: item.isConsumable ? "расходник" : "экипировка",
      }));
      console.table(rows);
      const ids = items.map((i) => i.id);
      console.log("[Mousefall] массив id (скопировать):", ids);
      return ids;
    },
  };

  console.info("[Mousefall] консоль: MousefallDev.addItemById(\"id\"), MousefallDev.listItemIds()");
}
