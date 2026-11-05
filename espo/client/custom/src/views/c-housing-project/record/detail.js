// Карточка проекта без правой служебной колонки (ответственный, группы),
// чтобы шахматка в нижней панели шла на всю ширину и подъезды стояли рядом.
define('custom:views/c-housing-project/record/detail', ['views/record/detail'], (DetailRecordView) => {

    return class extends DetailRecordView {

        sideDisabled = true;
        isWide = true;
    };
});
