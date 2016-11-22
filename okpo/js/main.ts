namespace App {
    export class Random {
        static generate() {
            return Math.random().toFixed(2);
        }

        static getRandomColor() {
            let alphabet = '0123456789ABCDEF';
            let color = '#';
            for (var i = 0; i < 6; i++) {
                color += alphabet[Math.floor(Math.random() * 16)];
            }
            return color;
        }
    }
    export class Constants {
        static ROWS:number = 10;
        static COLS:number = 5;
        static SCALE:number = 2;
        static CHART_OPTIONS = {
            scales: {
                xAxes: [{
                    display: true
                }],
                yAxes: [{
                    display: true,
                    scaleLabel: {
                        show: true,
                        labelString: 'Value'
                    },
                    ticks: {
                        suggestedMin: 0,
                        suggestedMax: 1
                    }
                }]
            }
        };
    }

    export class Main {
        dataFromTable:Array<Array<number>> = [];
        labelNames:Array<string> = ['Защищенность',
            'Интенсивность отражения угрозы',
            'Интенсивность контроля',
            'Интенсивность воздействия',
            'Интенсивность отказов'];

        //целевая функция
        ema = new EMA({period: App.Constants.SCALE, values: []});
        targetFunc:number = 1;
        chart;
        // Вероятность отражения угрозы
        pOt:number = 0.8;


        constructor(public table:HTMLElement) {
            this.initTable(App.Constants.ROWS)
            this.fillTableWithData();
            this.render();
        }

        public newData(){
            $("table tbody").empty()
            this.initTable(App.Constants.ROWS)
            this.fillTableWithData()
        }

        /**
         * Защищенность
         * @param {Number} i_ot интенсивность отражения угрозы
         * @param {Number} i_c интенсивность контроля
         * @param {Number} i_v интенсивность воздействия угрозы
         * @return {Number} target value
         */
        private calculateTargetValue(i_ot:number, i_c:number, i_v:number):string {
            let local_ot = 1 / i_ot;
            let local_c = 1 / i_c;
            let local_v = i_v * (1 - this.pOt);
            let local_n = 1 / local_v;

            let result = local_v / (local_n + local_ot + local_c);

            return result.toFixed(2);
        }

        private getLCL(k:number, rowNumber:number):number {
            return this.targetFunc - App.Constants.SCALE * this.getSigma(k, rowNumber) * this.getLCLsqrt(k);
        }

        private getSigma(k:number, rowNumber:number):number {
            var xSum = 0,
                xCur = this.dataFromTable[rowNumber][k],
                n = this.dataFromTable[rowNumber].length;

            for (let i = 0; i < n; i++) {
                let elem = this.dataFromTable[rowNumber][i];
                xSum += Math.pow(elem - xCur, 2);
            }

            return Math.sqrt(xSum / n);
        }

        private getLCLsqrt(k:number) {
            var lambda = 0.2,
                part1 = lambda / (2 - lambda),
                part2 = 1 - Math.pow((1 - lambda), (2 * k + 1));

            return Math.sqrt(part1 * part2);
        }

        private initTable(rowCount:number) {
            var rows = [],
                colsNum = this.table.find('td').length,
                row, el;

            for (var i = 0; i < rowCount; i++) {
                row = [];

                for (var j = 0; j < colsNum; j++) {
                    if (j === 0) {
                        el = i + 1;
                    } else {
                        el = '<input type="text" class="cell form-control"/>';
                    }

                    row.push('<td>' + el + '</td>');
                }

                rows.push('<tr>' + row + '</tr>');
            }

            this.table.find("tbody").append(rows);
        }

        private  fillTableWithData() {

            var cells = $('.cell');

            for (let i = 0; i < App.Constants.ROWS; i++) {
                let index = i * App.Constants.COLS;

                for (let j = 1; j <= 4; j++) {
                    cells.eq(index + j).val(App.Random.generate());
                }

                let value = this.calculateTargetValue(
                    cells.eq(index + 1).val(),
                    cells.eq(index + 2).val(),
                    cells.eq(index + 3).val());
                cells.eq(index).val(value);
            }

        }

        private recalculateUiData() {
            let cells = $('.cell');

            for (let i = 0; i < App.Constants.ROWS; i++) {
                let index = i * App.Constants.COLS;
                cells.eq(index).val(this.calculateTargetValue(
                    cells.eq(index + 1).val(),
                    cells.eq(index + 2).val(),
                    cells.eq(index + 3).val()));
            }

        }

        private retrieveDataFromTable() {
            let rows = this.table.find('tr');

            this.dataFromTable = [];
            for (let i = 0; i < App.Constants.COLS; i++) {
                this.dataFromTable.push([]);
            }
            let self = this;
            //skip first row
            for (let i = 1; i < rows.length; i++) {
                rows.eq(i).children('td').map(function (j) {
                    if (j === 0) {
                        return;
                    }

                    let val = $(this).find('input').val();

                    if (val) {
                        return self.dataFromTable[j - 1].push(parseFloat(val));
                    }
                }).get();
            }
        }

        public render() {
            let dataset,
                labelsX = [];
            // обновляем целевую функцию
            this.targetFunc = $('.targetFunc').val() || this.targetFunc;

            this.recalculateUiData();

            this.retrieveDataFromTable();

            for (let i = 1; i <= App.Constants.ROWS; i++) {
                labelsX.push(i);
            }


            dataset = this.dataFromTable.map((line, i)=> {
                return {
                    label: this.labelNames[i],
                    fill: false,
                    borderColor: App.Random.getRandomColor(),
                    borderWidth: 2,
                    data: line.map((elem, num) => {
                        return {
                            x: num,
                            y: elem
                        };
                    })
                };
            });

            this.render_fillDatasetWithLcl(dataset);
            this.render_fillDatasetWithEwma(dataset);
            this.render_updateChart(dataset, labelsX);
        }

        private render_fillDatasetWithLcl(dataset) {
            this.dataFromTable.map((line, i)=> {
                dataset.push({
                    label: 'LCL: ' + this.labelNames[i],
                    fill: false,
                    borderColor: App.Random.getRandomColor(),
                    borderWidth: 2,
                    borderDash: [5, 15],
                    data: line.map((elem, num)=> {
                        let lcl = this.getLCL(num, i);
                        return {
                            x: num,
                            y: lcl
                        };
                    })
                });
            });
        }

        private render_fillDatasetWithEwma(dataset) {
            this.dataFromTable.map((line, i) => {
                dataset.push({
                    label: 'EWMA:' + this.labelNames[i],
                    fill: false,
                    borderColor: App.Random.getRandomColor(),
                    borderWidth: 1,
                    borderDash: [15, 25],
                    data: line.map((elem, num) => {
                        return {
                            x: num,
                            y: this.ema.nextValue(elem) || elem
                        };
                    })
                });
            });
        }

        private render_updateChart(dataset, labelsX) {
            if (this.chart) {
                this.chart.destroy();
                this.chart.clear();
                delete this.chart;
            }

            this.chart = new Chart($('#chart').eq(0), {
                type: 'line',
                data: {
                    labels: labelsX,
                    datasets: dataset
                },
                options: App.Constants.CHART_OPTIONS
            });
        }
    }
}
var main
$(document).ready(() => {
    main = new App.Main($('.table'));
    $('.render').off("click").on("click", ()=>main.render());
    $('.newData').off('click').on('click', ()=>main.newData());
});