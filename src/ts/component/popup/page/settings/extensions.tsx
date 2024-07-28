import * as React from 'react';
import { observer } from 'mobx-react';
import { Title, Label, Select, Switch, Input, Button } from 'Component';
import { I, S, U, translate, Action, analytics, C } from 'Lib';

const PopupSettingsPageExtensions = observer(class PopupSettingsPageExtensions extends React.Component<I.PopupSettings> {
	refURL: any = null;
	refDeveloperMode: any = false;

	constructor (props: I.PopupSettings) {
		super(props);

		C.ExtensionGetDeveloperMode((message: any) => {
			console.log('ExtensionGetDeveloperMode', message);
			this.refDeveloperMode.setValue(message.developerMode);
		});

	};

	render () {
		return (
			<React.Fragment>
				<Title text="Extensions" />
				<div className="item">
					<Label text="Enable Developer Mode" />
					<Switch className="big" ref={ref => this.refDeveloperMode = ref} onChange={(e: any, v: boolean) => this.onSetMode(v)} />
				</div>
				<div className="item">
					<Label text="Install By URL" />
					<Input
						ref={ref => this.refURL = ref}
						value=""
					/>
					<Button 
						text="Install"
						onClick={() => this.onInstallByURL()} 
					/>
				</div>
			</React.Fragment>
		);
	};

	onSetMode (e: boolean) {
		C.DeviceList((message: any) => {
			console.log('DeviceList', message);
		});
		C.ExtensionGetDeveloperMode((message: any) => {
			console.log('ExtensionGetDeveloperMode', message);
		});

		console.log('onSetMode', e);
		C.ExtensionSetDeveloperMode(e, (message: any) => {
			console.log('ExtensionSetDeveloperMode', message);
		});
	};

	onInstallByURL () {
		const url: string = this.refURL.getValue();

		console.log('onInstallByURL', url);

		C.ExtensionInstallByURL(url, (message: any) => {
			console.log('ExtensionInstallByURL', message);
		});
	}

});

export default PopupSettingsPageExtensions;
