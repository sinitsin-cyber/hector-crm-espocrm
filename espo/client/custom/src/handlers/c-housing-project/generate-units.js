// Кнопка «Создать квартиры» на карточке проекта: строит объекты по схеме
// подъезды × этажи × квартиры на этаже. Нумерация сквозная, как в доме:
// подъезд 1 — квартиры 1…(этажей × на этаже), подъезд 2 продолжает и т. д.
// Квартиры, которые уже стоят на своём месте (подъезд, этаж, номер), не трогаются.
define('custom:handlers/c-housing-project/generate-units', [], () => {

    const SCOPE = 'CProperty';
    const PAGE_SIZE = 200;
    const PARALLEL = 5;

    return class {

        constructor(view) {
            this.view = view;
        }

        translate(key, params) {
            let text = this.view.translate(key, 'strings', 'CHousingProject');

            Object.entries(params || {}).forEach(([name, value]) => {
                text = text.replace('{' + name + '}', value);
            });

            return text;
        }

        async loadExistingKeys(projectId) {
            const keySet = new Set();
            let offset = 0;

            while (true) {
                const response = await Espo.Ajax.getRequest(SCOPE, {
                    maxSize: PAGE_SIZE,
                    offset: offset,
                    where: [{type: 'equals', attribute: 'housingProjectId', value: projectId}],
                    select: 'id,entrance,row,position',
                });

                const part = response.list || [];

                part.forEach(item => keySet.add(item.entrance + ':' + item.row + ':' + item.position));
                offset += part.length;

                if (!part.length || offset >= response.total) {
                    break;
                }
            }

            return keySet;
        }

        async generate() {
            const model = this.view.model;
            const entrances = model.get('entrances');
            const floors = model.get('floors');
            const perFloor = model.get('unitsPerFloor');

            if (!entrances || !floors || !perFloor) {
                Espo.Ui.warning(this.translate('needParams'));

                return;
            }

            const existingKeySet = await this.loadExistingKeys(model.id);
            const toCreateList = [];

            for (let entrance = 1; entrance <= entrances; entrance++) {
                for (let floor = 1; floor <= floors; floor++) {
                    for (let position = 1; position <= perFloor; position++) {
                        if (existingKeySet.has(entrance + ':' + floor + ':' + position)) {
                            continue;
                        }

                        const number = (entrance - 1) * floors * perFloor + (floor - 1) * perFloor + position;

                        toCreateList.push({
                            name: this.view.translate('apartmentPrefix', 'strings', SCOPE) + number,
                            housingProjectId: model.id,
                            propertyType: 'Apartment',
                            status: 'Free',
                            entrance: entrance,
                            row: floor,
                            position: position,
                        });
                    }
                }
            }

            if (!toCreateList.length) {
                Espo.Ui.success(this.translate('nothingToGenerate'));

                return;
            }

            await this.view.confirm(this.translate('confirmGenerate', {
                count: toCreateList.length,
                entrances: entrances,
                floors: floors,
                perFloor: perFloor,
            }));

            const total = toCreateList.length;
            let done = 0;

            const worker = async () => {
                while (toCreateList.length) {
                    await Espo.Ajax.postRequest(SCOPE, toCreateList.shift());

                    done++;

                    Espo.Ui.notify(this.translate('generating', {done: done, count: total}));
                }
            };

            try {
                await Promise.all(Array.from({length: PARALLEL}, worker));
            }
            finally {
                Espo.Ui.notify(false);
                model.trigger('cb:refresh');
                model.trigger('update-all');
            }

            Espo.Ui.success(this.translate('generated', {count: done}));
        }
    };
});
