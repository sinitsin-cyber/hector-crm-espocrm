// Шахматка объектов: по подъездам (если они заданы) сетка «этаж/ряд × номер»,
// клетки окрашены по статусу. Клик по объекту открывает карточку, клик по пустой
// клетке создаёт объект на этом месте.
//
// Работает отдельной страницей (#CProperty/chessboard) и панелью в карточке
// проекта (options.embedded = true: без заголовка и выбора проекта).
define('custom:views/c-property/chessboard', ['view'], (View) => {

    const SCOPE = 'CProperty';
    const NO_PROJECT = '__none';
    const PAGE_SIZE = 200;
    const SOLD_STATUS_LIST = ['Contract', 'Construction', 'Delivered'];
    const ON_SALE_STATUS_LIST = ['Free', 'Reserved'];

    // Цвет клетки по стилю статуса из entityDefs (style у enum-поля status).
    const STYLE_COLORS = {
        success: '#3d9a4b',
        warning: '#d99a1e',
        primary: '#3a73c0',
        info: '#2fa3b5',
        danger: '#c64848',
        default: '#8a9099',
    };

    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const STYLE = `
        .cb-toolbar { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin-bottom: 10px; }
        .cb-toolbar select { max-width: 320px; }
        .cb-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
        .cb-legend-item { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
        .cb-legend-item.cb-dim { opacity: .4; }
        .cb-dot { width: 13px; height: 13px; border-radius: 3px; display: inline-block;
            border: 1.5px solid var(--cb-color); background: color-mix(in srgb, var(--cb-color) 14%, transparent); }
        .cb-summary { color: var(--text-muted-color, #888); }
        .cb-rooms { display: flex; gap: 4px; margin-left: auto; }
        .cb-rooms .btn { padding: 2px 10px; }
        .cb-blocks { display: flex; flex-wrap: nowrap; gap: 16px 18px; overflow-x: auto; padding-bottom: 6px; }
        .cb-block-title { text-align: center; font-weight: 600; margin: 2px 0 4px; }
        .cb-grid { border-collapse: separate; border-spacing: 4px; }
        .cb-grid th { font-weight: normal; text-align: center; padding: 0 2px; color: var(--text-muted-color, #888);
            font-size: 0.85em; white-space: nowrap; }
        .cb-grid th.cb-row-head { text-align: right; padding-right: 4px; }
        .cb-grid td { vertical-align: top; padding: 0; }
        .cb-cell { width: 94px; min-height: 58px; padding: 4px 6px; border-radius: 4px; cursor: pointer;
            border: 1.5px solid var(--cb-color); background: color-mix(in srgb, var(--cb-color) 13%, transparent);
            line-height: 1.25; font-size: 0.85em; }
        .cb-cell:hover { background: color-mix(in srgb, var(--cb-color) 26%, transparent); }
        .cb-cell + .cb-cell { margin-top: 4px; }
        .cb-cell.cb-overlap { outline: 2px dashed #c64848; outline-offset: 1px; }
        .cb-cell.cb-dim { opacity: .18; }
        .cb-name { font-weight: 700; color: var(--cb-color); white-space: nowrap; overflow: hidden;
            text-overflow: ellipsis; font-size: 1.12em; }
        .cb-meta, .cb-client { color: var(--text-muted-color, #888); white-space: nowrap; overflow: hidden;
            text-overflow: ellipsis; }
        .cb-price { white-space: nowrap; color: var(--text-muted-color, #888); }
        .cb-empty { width: 94px; height: 58px; border-radius: 4px; border: 1px dashed rgba(127,127,127,.3); }
        .cb-empty.cb-can-create { cursor: pointer; display: flex; align-items: center; justify-content: center;
            color: transparent; font-size: 1.3em; }
        .cb-empty.cb-can-create:hover { color: var(--text-muted-color, #888); border-color: rgba(127,127,127,.7); }
        .cb-ghost th, .cb-ghost-col { opacity: .55; }
        .cb-message { padding: 16px 0; color: var(--text-muted-color, #888); }
    `;

    return class extends View {

        templateContent = `
            <style>{{{style}}}</style>
            {{#unless embedded}}
            <div class="page-header">
                <div class="row">
                    <div class="col-sm-7 col-xs-7">
                        <h3 class="header-title">
                            <a href="#CProperty" class="action">{{scopeLabel}}</a>
                            <span class="breadcrumb-separator"><span></span></span>
                            {{title}}
                        </h3>
                    </div>
                    <div class="col-sm-5 col-xs-5">
                        <div class="header-buttons btn-group pull-right">
                            {{#if canCreate}}
                            <button class="btn btn-default" data-action="createProperty">
                                <span class="fas fa-plus fa-sm"></span>
                                <span class="hidden-xs">{{createLabel}}</span>
                            </button>
                            {{/if}}
                            <a class="btn btn-default" href="#CProperty" title="{{scopeLabel}}">
                                <span class="fas fa-list"></span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            {{/unless}}
            <div class="cb-body">{{{body}}}</div>
        `;

        data() {
            return {
                style: STYLE,
                embedded: this.embedded,
                scopeLabel: this.translate(SCOPE, 'scopeNamesPlural'),
                title: this.translate('Chessboard', 'labels', SCOPE),
                createLabel: this.translate('Create CProperty', 'labels', SCOPE),
                canCreate: this.canCreate,
                body: this.buildBodyHtml(),
            };
        }

        setup() {
            this.embedded = !!this.options.embedded;
            this.projectId = this.options.projectId || null;
            this.projectList = [];
            this.propertyList = [];
            this.hiddenStatusList = [];
            this.roomsFilter = null;

            const fieldDefs = this.getMetadata().get(['entityDefs', SCOPE, 'fields']) || {};

            this.statusList = (fieldDefs.status || {}).options || [];
            this.statusStyle = (fieldDefs.status || {}).style || {};
            this.roomsList = ((fieldDefs.rooms || {}).options || []).filter(item => item !== '');
            this.canCreate = this.getAcl().check(SCOPE, 'create');

            const language = this.getPreferences().get('language') || this.getConfig().get('language') || 'en_US';

            this.locale = language.replace('_', '-');

            this.addHandler('change', 'select[data-name="project"]', (e, target) => {
                this.selectProject(target.value);
            });

            this.addHandler('click', '[data-action="toggleStatus"]', (e, target) => {
                this.toggleStatus(target.dataset.status);
            });

            this.addHandler('click', '[data-action="filterRooms"]', (e, target) => {
                this.roomsFilter = target.dataset.rooms || null;
                this.reRender();
            });

            this.addHandler('click', '[data-action="openProperty"]', (e, target) => {
                this.openProperty(target.dataset.id);
            });

            this.addHandler('click', '[data-action="createAt"]', (e, target) => {
                const entrance = target.dataset.entrance ? parseInt(target.dataset.entrance) : null;

                this.createProperty(entrance, parseInt(target.dataset.row), parseInt(target.dataset.position));
            });

            this.addHandler('click', '[data-action="createProperty"]', () => {
                this.createProperty();
            });

            // Карточка проекта просит перерисовать шахматку (после генерации квартир или правки).
            if (this.options.model) {
                this.listenTo(this.options.model, 'cb:refresh', () => this.reload());
            }

            this.wait(this.loadAll());
        }

        afterRender() {
            if (!this.embedded) {
                this.setPageTitle();
            }
        }

        setPageTitle() {
            try {
                this.getHelper().pageTitle.setTitle(this.translate('Chessboard', 'labels', SCOPE));
            }
            catch (e) {}
        }

        async loadAll() {
            if (!this.embedded) {
                await this.loadProjects();
            }

            if (!this.projectId) {
                this.projectId = this.projectList.length ? this.projectList[0].id : NO_PROJECT;
            }

            await this.loadProperties();
        }

        async loadProjects() {
            const response = await Espo.Ajax.getRequest('CHousingProject', {
                maxSize: PAGE_SIZE,
                orderBy: 'name',
                order: 'asc',
                select: 'id,name',
            });

            this.projectList = response.list || [];
        }

        async loadProperties() {
            const where = this.projectId === NO_PROJECT ?
                [{type: 'isNull', attribute: 'housingProjectId'}] :
                [{type: 'equals', attribute: 'housingProjectId', value: this.projectId}];

            let list = [];
            let offset = 0;

            // API отдаёт максимум 200 записей за раз — дочитываем страницами.
            while (true) {
                const response = await Espo.Ajax.getRequest(SCOPE, {
                    maxSize: PAGE_SIZE,
                    offset: offset,
                    where: where,
                    orderBy: 'position',
                    order: 'asc',
                    select: 'id,name,status,propertyType,entrance,rooms,row,position,area,plotArea,' +
                        'price,priceCurrency,contactId,contactName,reservedUntil',
                });

                const part = response.list || [];

                list = list.concat(part);
                offset += part.length;

                if (!part.length || offset >= response.total) {
                    break;
                }
            }

            this.propertyList = list;
        }

        async reload() {
            await this.loadProperties();
            await this.reRender();
        }

        async selectProject(projectId) {
            this.projectId = projectId;
            this.roomsFilter = null;

            this.getRouter().navigate('#CProperty/chessboard/projectId=' + projectId, {trigger: false});

            Espo.Ui.notifyWait();
            await this.loadProperties();
            Espo.Ui.notify(false);

            await this.reRender();
        }

        toggleStatus(status) {
            const index = this.hiddenStatusList.indexOf(status);

            index === -1 ?
                this.hiddenStatusList.push(status) :
                this.hiddenStatusList.splice(index, 1);

            this.reRender();
        }

        getProjectName() {
            if (this.embedded && this.options.model) {
                return this.options.model.get('name');
            }

            const project = this.projectList.find(item => item.id === this.projectId);

            return project ? project.name : null;
        }

        openProperty(id) {
            this.createView('modal', 'views/modals/detail', {scope: SCOPE, id: id}, view => {
                view.render();

                this.listenToOnce(view, 'after:save', () => this.reload());
                this.listenToOnce(view, 'after:destroy', () => this.reload());
            });
        }

        createProperty(entrance, row, position) {
            const attributes = {};

            if (this.projectId && this.projectId !== NO_PROJECT) {
                attributes.housingProjectId = this.projectId;
                attributes.housingProjectName = this.getProjectName();
            }

            if (row !== undefined && position !== undefined) {
                attributes.row = row;
                attributes.position = position;
                attributes.name = (entrance ? entrance + '-' : '') + row + '-' + position;
            }

            if (entrance) {
                attributes.entrance = entrance;
                attributes.propertyType = 'Apartment';
            }

            this.createView('modal', 'views/modals/edit', {scope: SCOPE, attributes: attributes}, view => {
                view.render();

                this.listenToOnce(view, 'after:save', () => this.reload());
            });
        }

        getStatusColor(status) {
            return STYLE_COLORS[this.statusStyle[status]] || STYLE_COLORS.default;
        }

        formatNumber(value, fractionDigits) {
            return new Intl.NumberFormat(this.locale, {maximumFractionDigits: fractionDigits}).format(value);
        }

        getCurrencySymbol(currency) {
            currency = currency || this.getConfig().get('defaultCurrency') || 'RUB';

            try {
                return new Intl.NumberFormat(this.locale, {style: 'currency', currency: currency})
                    .formatToParts(0)
                    .find(part => part.type === 'currency').value;
            }
            catch (e) {
                return currency;
            }
        }

        // Полная цена: «6 550 000 ₽».
        formatPrice(value, currency) {
            if (value === null || value === undefined) {
                return '';
            }

            return this.formatNumber(value, 0) + ' ' + this.getCurrencySymbol(currency);
        }

        // Короткая цена для клетки: «6,55 млн».
        formatPriceShort(value) {
            if (value >= 1000000) {
                return this.formatNumber(value / 1000000, 2) + ' ' + this.translate('million', 'strings', SCOPE);
            }

            return this.formatNumber(value, 0);
        }

        // Номер в клетке: у квартир «Кв. 28» показываем как «28».
        getCellName(item) {
            const name = item.name || '';
            const match = item.propertyType === 'Apartment' ? name.match(/(\d+)\s*$/) : null;

            return match ? match[1] : name;
        }

        isItemDimmed(item) {
            if (this.hiddenStatusList.includes(item.status)) {
                return true;
            }

            return !!this.roomsFilter && item.rooms !== this.roomsFilter;
        }

        buildBodyHtml() {
            return this.buildToolbarHtml() + this.buildGridHtml();
        }

        buildToolbarHtml() {
            let html = '<div class="cb-toolbar">';

            if (!this.embedded) {
                const optionsHtml = this.projectList
                    .map(item => `<option value="${esc(item.id)}"${item.id === this.projectId ? ' selected' : ''}>` +
                        `${esc(item.name)}</option>`)
                    .join('') +
                    `<option value="${NO_PROJECT}"${this.projectId === NO_PROJECT ? ' selected' : ''}>` +
                    `${esc(this.translate('noProject', 'strings', SCOPE))}</option>`;

                html += `<select class="form-control" data-name="project">${optionsHtml}</select>`;
            }

            const countMap = {};

            this.propertyList.forEach(item => countMap[item.status] = (countMap[item.status] || 0) + 1);

            // В легенде только встречающиеся статусы; если объектов нет — все.
            const legendStatusList = this.propertyList.length ?
                this.statusList.filter(status => countMap[status]) :
                this.statusList;

            const legendHtml = legendStatusList
                .map(status => {
                    const dim = this.hiddenStatusList.includes(status) ? ' cb-dim' : '';

                    return `<span class="cb-legend-item${dim}" data-action="toggleStatus" data-status="${esc(status)}">` +
                        `<span class="cb-dot" style="--cb-color:${this.getStatusColor(status)}"></span>` +
                        `${esc(this.getLanguage().translateOption(status, 'status', SCOPE))}: ` +
                        `<b>${countMap[status] || 0}</b></span>`;
                })
                .join('');

            html += `<div class="cb-legend">${legendHtml}${this.buildSummaryHtml()}</div>`;
            html += this.buildRoomsFilterHtml();
            html += '</div>';

            return html;
        }

        buildSummaryHtml() {
            if (!this.propertyList.length) {
                return '';
            }

            const sum = statusList => this.propertyList
                .filter(item => statusList.includes(item.status))
                .reduce((total, item) => total + (item.price || 0), 0);

            const currency = (this.propertyList.find(item => item.priceCurrency) || {}).priceCurrency;
            const symbol = this.getCurrencySymbol(currency);
            const soldSum = sum(SOLD_STATUS_LIST);
            const onSaleSum = sum(ON_SALE_STATUS_LIST);

            let html = `${esc(this.translate('total', 'strings', SCOPE))}: ${this.propertyList.length}`;

            if (soldSum) {
                html += ` · ${esc(this.translate('soldSum', 'strings', SCOPE))} ` +
                    `${esc(this.formatPriceShort(soldSum))} ${esc(symbol)}`;
            }

            if (onSaleSum) {
                html += ` · ${esc(this.translate('onSaleSum', 'strings', SCOPE))} ` +
                    `${esc(this.formatPriceShort(onSaleSum))} ${esc(symbol)}`;
            }

            return `<span class="cb-summary">${html}</span>`;
        }

        buildRoomsFilterHtml() {
            const presentList = this.roomsList.filter(rooms => this.propertyList.some(item => item.rooms === rooms));

            if (!presentList.length) {
                return '';
            }

            const shortMap = this.translate('roomsShort', 'strings', SCOPE) || {};

            const button = (rooms, label) => {
                const active = (this.roomsFilter || '') === rooms ? ' btn-primary' : ' btn-default';

                return `<button class="btn btn-sm${active}" data-action="filterRooms" data-rooms="${esc(rooms)}">` +
                    `${esc(label)}</button>`;
            };

            return '<div class="cb-rooms">' +
                button('', this.translate('allRooms', 'strings', SCOPE)) +
                presentList.map(rooms => button(rooms, shortMap[rooms] || rooms)).join('') +
                '</div>';
        }

        buildGridHtml() {
            if (!this.embedded && !this.projectList.length && !this.propertyList.length) {
                return `<div class="cb-message">${esc(this.translate('noProjects', 'strings', SCOPE))}</div>`;
            }

            if (!this.propertyList.length && !this.canCreate) {
                return `<div class="cb-message">${esc(this.translate('empty', 'strings', SCOPE))}</div>`;
            }

            const hasEntrances = this.propertyList.some(item => item.entrance);

            return hasEntrances ? this.buildEntranceBlocksHtml() : this.buildFlatGridHtml();
        }

        // Посёлок или объекты без подъездов: одна сетка, сверху и справа — места под новые объекты.
        buildFlatGridHtml() {
            const rowList = Array.from(new Set(this.propertyList.map(item => item.row ?? 0))).sort((a, b) => b - a);
            const maxPosition = Math.max(0, ...this.propertyList.map(item => item.position ?? 0));
            const hasProperties = rowList.length > 0;

            if (this.canCreate) {
                rowList.unshift(hasProperties ? rowList[0] + 1 : 1);
            }

            const html = this.buildTableHtml({
                itemList: this.propertyList,
                entrance: null,
                rowList: rowList,
                columnCount: maxPosition + (this.canCreate ? 1 : 0),
                ghostRow: this.canCreate ? rowList[0] : null,
                ghostFromColumn: maxPosition + 1,
                rowLabel: this.translate('rowLabel', 'strings', SCOPE),
            });

            const message = hasProperties ? '' :
                `<div class="cb-message">${esc(this.translate('empty', 'strings', SCOPE))}</div>`;

            return message + `<div class="cb-blocks">${html}</div>`;
        }

        // Многоквартирный дом: блок на каждый подъезд, этажи общие для всех блоков.
        buildEntranceBlocksHtml() {
            const groupMap = new Map();

            this.propertyList.forEach(item => {
                const key = item.entrance || 0;

                if (!groupMap.has(key)) {
                    groupMap.set(key, []);
                }

                groupMap.get(key).push(item);
            });

            const rowList = Array.from(new Set(this.propertyList.map(item => item.row ?? 0))).sort((a, b) => b - a);
            const entranceLabel = this.translate('entranceLabel', 'strings', SCOPE);

            const blocksHtml = Array.from(groupMap.keys())
                .sort((a, b) => (a || Infinity) - (b || Infinity))
                .map(entrance => {
                    const itemList = groupMap.get(entrance);
                    const maxPosition = Math.max(1, ...itemList.map(item => item.position ?? 0));
                    const title = entrance ?
                        entranceLabel + ' ' + entrance :
                        this.translate('noEntrance', 'strings', SCOPE);

                    return `<div class="cb-block"><div class="cb-block-title">${esc(title)}</div>` +
                        this.buildTableHtml({
                            itemList: itemList,
                            entrance: entrance || null,
                            rowList: rowList,
                            columnCount: maxPosition,
                            ghostRow: null,
                            ghostFromColumn: maxPosition + 1,
                            rowLabel: '',
                            hideColumnHeader: true,
                        }) +
                        '</div>';
                })
                .join('');

            return `<div class="cb-blocks">${blocksHtml}</div>`;
        }

        buildTableHtml(o) {
            // Ключ клетки «ряд:номер» → объекты в ней (обычно один).
            const cellMap = {};

            o.itemList.forEach(item => {
                const key = (item.row ?? 0) + ':' + (item.position ?? 0);

                (cellMap[key] = cellMap[key] || []).push(item);
            });

            let html = '<table class="cb-grid">';

            if (!o.hideColumnHeader) {
                html += '<thead><tr><th></th>';

                for (let position = 1; position <= o.columnCount; position++) {
                    const ghost = position >= o.ghostFromColumn ? ' class="cb-ghost-col"' : '';

                    html += `<th${ghost}>${position}</th>`;
                }

                html += '</tr></thead>';
            }

            html += '<tbody>';

            o.rowList.forEach(row => {
                const rowHead = o.rowLabel ? esc(o.rowLabel) + ' ' + esc(row) : esc(row);

                html += `<tr${row === o.ghostRow ? ' class="cb-ghost"' : ''}>` +
                    `<th class="cb-row-head">${rowHead}</th>`;

                for (let position = 1; position <= o.columnCount; position++) {
                    const items = cellMap[row + ':' + position] || [];

                    html += '<td>' + (items.length ?
                        items.map(item => this.buildCellHtml(item, items.length > 1)).join('') :
                        this.buildEmptyCellHtml(o.entrance, row, position)) + '</td>';
                }

                html += '</tr>';
            });

            html += '</tbody></table>';

            return html;
        }

        buildCellHtml(item, isOverlap) {
            const statusLabel = this.getLanguage().translateOption(item.status, 'status', SCOPE);
            const shortMap = this.translate('roomsShort', 'strings', SCOPE) || {};
            const metaList = [];

            if (item.rooms) {
                metaList.push(shortMap[item.rooms] || item.rooms);
            }

            if (item.area) {
                metaList.push(this.formatNumber(item.area, 1) + ' ' + this.translate('unitArea', 'strings', SCOPE));
            }

            if (item.plotArea) {
                metaList.push(this.formatNumber(item.plotArea, 2) + ' ' + this.translate('unitPlot', 'strings', SCOPE));
            }

            const titleList = [item.name, statusLabel];

            if (item.price) {
                titleList.push(this.formatPrice(item.price, item.priceCurrency));
            }

            if (item.contactName) {
                titleList.push(item.contactName);
            }

            if (isOverlap) {
                titleList.push(this.translate('overlap', 'strings', SCOPE));
            }

            const classList = ['cb-cell'];

            if (isOverlap) {
                classList.push('cb-overlap');
            }

            if (this.isItemDimmed(item)) {
                classList.push('cb-dim');
            }

            return `<div class="${classList.join(' ')}" data-action="openProperty" data-id="${esc(item.id)}" ` +
                `style="--cb-color:${this.getStatusColor(item.status)}" title="${esc(titleList.join(' · '))}">` +
                `<div class="cb-name">${esc(this.getCellName(item))}</div>` +
                (metaList.length ? `<div class="cb-meta">${esc(metaList.join(' · '))}</div>` : '') +
                (item.price ? `<div class="cb-price">${esc(this.formatPriceShort(item.price))}</div>` : '') +
                (item.contactName ? `<div class="cb-client">${esc(item.contactName)}</div>` : '') +
                `</div>`;
        }

        buildEmptyCellHtml(entrance, row, position) {
            if (!this.canCreate) {
                return '<div class="cb-empty"></div>';
            }

            return `<div class="cb-empty cb-can-create" data-action="createAt" ` +
                `data-entrance="${esc(entrance || '')}" data-row="${esc(row)}" data-position="${esc(position)}">+</div>`;
        }
    };
});
